import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getActiveBlock } from "@/lib/coach/training-block-state";
import { getTemplateSet, createTemplateSet, countSessionsForTemplates, type StoredTemplate } from "@/lib/coach/workout-templates";
import { generateWorkoutTemplateSet, blockPhaseIndex, repsTargetForBlock } from "@/lib/coach/generate-workout";
import type { BlockType, EquipmentType } from "@/lib/coach/types";

// Union of every resource's equipment at a gym — used only here, where
// there's no specific booked resource to scope to yet (unlike a real
// session, which always has one via workout_sessions.resource_id).
// Permissive on purpose: a multi-resource gym with different kit per
// resource would rather show a template that might need a resource swap
// than wrongly exclude an exercise the member could actually do at their
// gym. Every gym in production is single-resource as of 2026-08-29 anyway
// (see podHq's ROADMAP.md), so this union is a no-op in practice.
async function getGymEquipment(gym: string): Promise<EquipmentType[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("pod_resources").select("equipment").eq("gym", gym);
  if (error) throw new Error(error.message);
  const union = new Set<EquipmentType>();
  for (const row of data ?? []) {
    for (const item of (row.equipment as EquipmentType[] | null) ?? []) union.add(item);
  }
  return [...union];
}

export interface BlockWorkoutPreview {
  blockType: BlockType;
  phaseIndex: 0 | 1 | 2;
  repsTarget: number;
  templates: StoredTemplate[];
  // Which letter a real booking would generate right now — same
  // usedCount % length rotation resolveTemplatedPlan uses in
  // workout-session.ts, kept in sync here rather than guessed, so "today's
  // pick" shown without a booking is never wrong about what booking one
  // would actually produce.
  nextLetter: StoredTemplate["letter"] | null;
}

// Home for "View this block's workouts" on /training (2026-08-29, Carl's
// call — members should be able to browse Workout A/B/C without needing a
// booking first). Reuses the exact same template store a real session
// draws from (getTemplateSet/createTemplateSet — see workout-templates.ts)
// so this is never a second, possibly-drifted copy of what a booking would
// actually generate; it just resolves and — if this phase has never been
// used yet — generates the set eagerly instead of waiting for a booking to
// trigger it. No weight is shown anywhere here (weight only ever exists
// live, per-session, from RPE history — see instantiateTemplate) — this is
// a "what's coming" preview, not a live plan.
export async function getBlockWorkoutPreview(memberId: number, gym: string): Promise<BlockWorkoutPreview | null> {
  const profile = await getCoachProfile(memberId);
  if (!profile) return null;

  const blockHistory = await getBlockHistory(memberId);
  const activeBlock = getActiveBlock(profile, blockHistory);
  const phaseIndex = blockPhaseIndex(activeBlock.startedAt, new Date());

  let templates = await getTemplateSet(memberId, activeBlock.blockType, activeBlock.startedAt, phaseIndex);
  if (templates.length === 0) {
    const availableEquipment = await getGymEquipment(gym);
    const generated = generateWorkoutTemplateSet({ profile, availableEquipment, activeBlock });
    templates = await createTemplateSet(memberId, activeBlock.blockType, activeBlock.startedAt, phaseIndex, generated);
    if (templates.length === 0) {
      // Lost a create race to a concurrent request — same recovery as
      // resolveTemplatedPlan in workout-session.ts.
      templates = await getTemplateSet(memberId, activeBlock.blockType, activeBlock.startedAt, phaseIndex);
    }
  }

  let nextLetter: StoredTemplate["letter"] | null = null;
  if (templates.length > 0) {
    const usedCount = await countSessionsForTemplates(templates.map((t) => t.id));
    nextLetter = templates[usedCount % templates.length].letter;
  }

  return {
    blockType: activeBlock.blockType,
    phaseIndex,
    repsTarget: repsTargetForBlock(activeBlock, profile.goal, new Date()),
    templates,
    nextLetter,
  };
}
