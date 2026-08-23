import { londonMidnight, addLondonDays } from "@/lib/london-time";
import type { CoachProfile } from "@/lib/coach/coach-profile";
import { BLOCK_DURATION_WEEKS, type BlockType } from "@/lib/coach/types";

export interface ActiveBlock {
  blockType: BlockType;
  startedAt: string;
}

export type TrainingBlockState =
  | { kind: "no_profile" }
  | { kind: "in_block"; blockType: BlockType; startedAt: string; weeksRemaining: number; daysRemaining: number }
  | { kind: "transition_due"; currentBlockType: BlockType; scheduledNextBlockType: BlockType };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Most recent training_blocks row, or the implicit Block 1 (hypertrophy,
// anchored to coach_profiles.created_at) if the member has none yet — no
// row is ever written just to represent this, same "row existence =
// happened" convention as check_ins. `blockHistory` must already be
// sorted most-recent-first (matches training-blocks.ts's getBlockHistory
// ordering).
export function getActiveBlock(coachProfile: CoachProfile, blockHistory: ActiveBlock[]): ActiveBlock {
  if (blockHistory.length === 0) {
    return { blockType: "hypertrophy", startedAt: coachProfile.created_at };
  }
  return blockHistory[0];
}

// Deload's next step depends on what came before it — the most recent
// *non-deload* entry in history. Falls back to hypertrophy if history is
// too short to tell (shouldn't happen once a real deload has started,
// since a deload always follows a real block, but a safe default matters
// more than a theoretical unreachable branch here).
function previousRealBlockType(blockHistory: ActiveBlock[]): BlockType {
  const previous = blockHistory.find((b) => b.blockType !== "deload");
  return previous?.blockType ?? "hypertrophy";
}

function scheduledNextBlockType(current: BlockType, blockHistory: ActiveBlock[]): BlockType {
  if (current !== "deload") return "deload";
  return previousRealBlockType(blockHistory) === "strength" ? "hypertrophy" : "strength";
}

// Pure function mirroring checkin-state.ts's discriminated-union pattern
// exactly. Deliberately only two real states, not three like check-ins —
// a block transition sitting a few days late is harmless (nothing
// compounds, the member just keeps training safely in their current,
// already-confirmed-safe block), so there's no "overdue" tier to add.
export function getTrainingBlockState(
  coachProfile: CoachProfile | null,
  blockHistory: ActiveBlock[],
  now: Date
): TrainingBlockState {
  if (!coachProfile) return { kind: "no_profile" };

  const active = getActiveBlock(coachProfile, blockHistory);
  const durationWeeks = BLOCK_DURATION_WEEKS[active.blockType];
  const endMidnight = londonMidnight(addLondonDays(new Date(active.startedAt), durationWeeks * 7)).getTime();
  const nowMidnight = londonMidnight(now).getTime();

  if (nowMidnight >= endMidnight) {
    return {
      kind: "transition_due",
      currentBlockType: active.blockType,
      scheduledNextBlockType: scheduledNextBlockType(active.blockType, blockHistory),
    };
  }

  const daysRemaining = Math.round((endMidnight - nowMidnight) / MS_PER_DAY);
  return {
    kind: "in_block",
    blockType: active.blockType,
    startedAt: active.startedAt,
    weeksRemaining: Math.ceil(daysRemaining / 7),
    daysRemaining,
  };
}
