import { BLOCK_ATTENDANCE_KEEP_THRESHOLD, BLOCK_HIGH_RPE_THRESHOLD, BLOCK_MIN_RPE_SAMPLE, type BlockType } from "@/lib/coach/types";

export type BlockChangeRecommendation =
  | { kind: "shift"; nextBlockType: BlockType }
  | { kind: "keep"; reason: "low_attendance" | "insufficient_data" }
  | { kind: "extend_deload"; reason: "high_fatigue" };

export interface AttendanceInput {
  completedSessions: number;
  weeksElapsed: number;
  sessionsPerWeek: number;
}

// Pure function — the real attendance/RPE queries live in
// training-blocks.ts; this only decides what to recommend given already-
// fetched numbers. Only ever produces a suggestion a member must
// explicitly confirm (see training-block-state.ts's transition_due
// state) — never an autonomous change, which is what makes the
// deliberately-invented thresholds below acceptable (same category as
// CHECK_IN_GRACE_DAYS — not literature-cited numbers, defensible
// heuristics for a human-confirmed suggestion, not a threshold guarding
// an automatic action).
export function getBlockChangeRecommendation(
  scheduledNextType: BlockType,
  attendance: AttendanceInput,
  recentRpe: number[]
): BlockChangeRecommendation {
  const plannedSessions = attendance.sessionsPerWeek * attendance.weeksElapsed;
  const attendanceRatio = plannedSessions > 0 ? attendance.completedSessions / plannedSessions : 0;

  // A real coach wouldn't advance someone who missed roughly half their
  // planned sessions — they haven't earned the next phase's stimulus.
  if (attendanceRatio < BLOCK_ATTENDANCE_KEEP_THRESHOLD) {
    return { kind: "keep", reason: "low_attendance" };
  }

  // Fatigue only matters at the one real escalation point in the whole
  // cycle: coming out of a deload into a harder Strength block.
  // Hypertrophy→deload and strength→deload never escalate difficulty, so
  // there's nothing to gate there beyond attendance.
  if (scheduledNextType === "strength") {
    // Corrected 2026-08-30 (coaching review) — below the RPE sample
    // floor, a thin sample used to just let this branch not fire,
    // silently falling through to "shift". That's backwards: not having
    // enough recent signal on how hard training's actually been is not
    // the same as having checked and found it's fine. A real coach who
    // doesn't have enough recent information wouldn't default to
    // green-lighting the harder phase — they'd hold. AMRAP/RFT sessions
    // never log per-set RPE (nothing to rate in a circuit), so this
    // branch increasingly matters as members adopt those custom formats
    // between deload and their next Strength escalation.
    if (recentRpe.length < BLOCK_MIN_RPE_SAMPLE) {
      return { kind: "keep", reason: "insufficient_data" };
    }
    const hardRatio = recentRpe.filter((rpe) => rpe >= 4).length / recentRpe.length;
    if (hardRatio >= BLOCK_HIGH_RPE_THRESHOLD) {
      return { kind: "extend_deload", reason: "high_fatigue" };
    }
  }

  return { kind: "shift", nextBlockType: scheduledNextType };
}
