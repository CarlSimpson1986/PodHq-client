import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getTrainingBlockState } from "@/lib/coach/training-block-state";
import { getTrainingBlockRecommendation } from "@/lib/coach/training-block-recommendation";
import { blockPhaseIndex } from "@/lib/coach/generate-workout";
import { checkRateLimit } from "@/lib/rate-limit";

// Display copy for the "Phase 2 of 3" card (2026-08-25) — phase index
// itself comes from generate-workout.ts's blockPhaseIndex, the same
// function that actually drives the rep target, so this never drifts
// out of sync with what a member is really training that week.
const PHASE_LABELS = ["Weeks 1-4", "Weeks 5-8", "Weeks 9-12"] as const;
// Exact, not a "~" range — REP_TARGET_BY_BLOCK_PHASE (types.ts) moved off
// averaged ranges to clean, deliberately-chosen numbers 2026-08-28.
const PHASE_REP_DESCRIPTION: Record<"hypertrophy" | "strength", [string, string, string]> = {
  hypertrophy: ["12 reps", "6 reps", "15 reps"],
  strength: ["6 reps", "4 reps", "3 reps"],
};

export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/training-block");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  try {
    const coachProfile = await getCoachProfile(member.id);
    const now = new Date();
    const blockHistory = coachProfile ? await getBlockHistory(member.id) : [];
    const state = getTrainingBlockState(coachProfile, blockHistory, now);

    if (state.kind === "transition_due" && coachProfile) {
      const { recommendation, allowedBlockTypes } = await getTrainingBlockRecommendation(member.id, coachProfile, state, now);
      return NextResponse.json({ status: "ok", state, recommendation, allowedBlockTypes, phase: null });
    }

    let phase = null;
    if (state.kind === "in_block" && (state.blockType === "hypertrophy" || state.blockType === "strength")) {
      const index = blockPhaseIndex(state.startedAt, now);
      phase = {
        number: index + 1,
        of: 3,
        label: PHASE_LABELS[index],
        repsDescription: PHASE_REP_DESCRIPTION[state.blockType][index],
      };
    }

    return NextResponse.json({ status: "ok", state, recommendation: null, allowedBlockTypes: [], phase });
  } catch (error) {
    console.error("[training-block] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
