import "server-only";
import type { CoachProfile } from "@/lib/coach/coach-profile";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getActiveBlock, type TrainingBlockState } from "@/lib/coach/training-block-state";
import { getBlockProgress } from "@/lib/coach/block-progress";
import { getBlockChangeRecommendation, type BlockChangeRecommendation } from "@/lib/coach/block-change-gate";
import type { BlockType } from "@/lib/coach/types";

export interface TrainingBlockRecommendationResult {
  recommendation: BlockChangeRecommendation;
  // The only chosenBlockType values the confirm route will accept for
  // this recommendation — computed the same way by GET (to render the
  // options) and POST (to validate the choice), so a client can never
  // offer itself an option the server wouldn't also allow.
  allowedBlockTypes: BlockType[];
}

function allowedBlockTypesFor(recommendation: BlockChangeRecommendation, currentBlockType: BlockType): BlockType[] {
  switch (recommendation.kind) {
    case "shift":
      // Accepting the shift, or choosing to keep training in the current
      // block type a bit longer, are both offered — agency to stay is
      // always safe, agency to escalate past what the gate allows never
      // is, so "shift" is the only recommendation kind that ever offers
      // two options.
      return [recommendation.nextBlockType, currentBlockType];
    case "keep":
    case "extend_deload":
      return [currentBlockType];
  }
}

// Shared by GET /api/member/training-block (to render the suggestion) and
// POST .../confirm (to validate the member's choice against it) — both
// routes must derive the same recommendation from the same live data, or
// a confirm could accept an option the GET response never actually
// offered.
export async function getTrainingBlockRecommendation(
  memberId: number,
  coachProfile: CoachProfile,
  state: Extract<TrainingBlockState, { kind: "transition_due" }>,
  now: Date
): Promise<TrainingBlockRecommendationResult> {
  const blockHistory = await getBlockHistory(memberId);
  const active = getActiveBlock(coachProfile, blockHistory);
  const progress = await getBlockProgress(memberId, active.startedAt, now);

  const recommendation = getBlockChangeRecommendation(
    state.scheduledNextBlockType,
    {
      completedSessions: progress.completedSessions,
      weeksElapsed: progress.weeksElapsed,
      sessionsPerWeek: coachProfile.sessions_per_week,
    },
    progress.recentRpe
  );

  return { recommendation, allowedBlockTypes: allowedBlockTypesFor(recommendation, state.currentBlockType) };
}
