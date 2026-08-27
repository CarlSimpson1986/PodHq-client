import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GeneratedTemplate, TemplateLetter } from "@/lib/coach/generate-workout";

export interface StoredTemplate {
  id: number;
  letter: TemplateLetter;
  exercises: { key: string; name: string; muscleGroup: string }[];
}

// Looks up this member's already-generated A/B/C set for a given block +
// phase — empty array means none exist yet (first session of this
// phase), same "not found = generate it" idiom workout_sessions already
// uses per-booking. Keyed on block_type + block_started_at rather than a
// training_blocks.id FK — see 0067_workout_templates.sql's own comment
// for why (the common "implicit Block 1" case has no real row to
// reference).
export async function getTemplateSet(memberId: number, blockType: string, blockStartedAt: string, phaseIndex: number): Promise<StoredTemplate[]> {
  const admin = createAdminClient();
  const { data: templates, error } = await admin
    .from("workout_templates")
    .select("id, letter")
    .eq("member_id", memberId)
    .eq("block_type", blockType)
    .eq("block_started_at", blockStartedAt)
    .eq("phase_index", phaseIndex)
    .order("letter");
  if (error) throw new Error(error.message);
  if (!templates || templates.length === 0) return [];

  const templateIds = templates.map((t) => t.id);
  const { data: exercises, error: exercisesError } = await admin
    .from("workout_template_exercises")
    .select("template_id, exercise_key, name, muscle_group, sort_order")
    .in("template_id", templateIds)
    .order("sort_order");
  if (exercisesError) throw new Error(exercisesError.message);

  return templates.map((t) => ({
    id: t.id,
    letter: t.letter as TemplateLetter,
    exercises: (exercises ?? [])
      .filter((e) => e.template_id === t.id)
      .map((e) => ({ key: e.exercise_key, name: e.name, muscleGroup: e.muscle_group })),
  }));
}

// Persists a freshly-generated A/B/C set. A concurrent request for the
// same (member, block, phase) can win the race between the caller's own
// existence check and this insert — same unique-index-as-the-real-guard
// pattern getOrCreateWorkoutSession already uses for workout_sessions.
// On a race, the caller re-fetches via getTemplateSet rather than this
// function retrying itself, so there's no risk of a half-written set.
export async function createTemplateSet(
  memberId: number,
  blockType: string,
  blockStartedAt: string,
  phaseIndex: number,
  generated: GeneratedTemplate[]
): Promise<StoredTemplate[]> {
  const admin = createAdminClient();
  const created: StoredTemplate[] = [];

  for (const { letter, exercises } of generated) {
    const { data: row, error } = await admin
      .from("workout_templates")
      .insert({ member_id: memberId, block_type: blockType, block_started_at: blockStartedAt, phase_index: phaseIndex, letter })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return []; // lost the race — caller re-fetches the winner's set
      throw new Error(error.message);
    }

    if (exercises.length > 0) {
      const rows = exercises.map((ex, i) => ({
        template_id: row.id,
        exercise_key: ex.key,
        name: ex.name,
        muscle_group: ex.muscleGroup,
        sort_order: i,
      }));
      const { error: exercisesError } = await admin.from("workout_template_exercises").insert(rows);
      if (exercisesError) throw new Error(exercisesError.message);
    }

    created.push({ id: row.id, letter, exercises });
  }

  return created;
}

// How many booked sessions have already used any template in this
// phase's A/B/C set — the rotation position (next letter = this count
// mod 3), read from workout_sessions.template_id rather than a separate
// counter, so a cancelled/refunded booking's absence is automatically
// reflected without needing its own cleanup.
export async function countSessionsForTemplates(templateIds: number[]): Promise<number> {
  if (templateIds.length === 0) return 0;
  const admin = createAdminClient();
  const { count, error } = await admin.from("workout_sessions").select("id", { count: "exact", head: true }).in("template_id", templateIds);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
