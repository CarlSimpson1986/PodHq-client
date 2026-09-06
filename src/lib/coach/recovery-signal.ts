import {
  RECOVERY_MIN_BASELINE_DAYS,
  RECOVERY_RESTING_HR_DELTA,
  RECOVERY_SLEEP_MINUTES_DELTA,
  type ReadinessLevel,
} from "@/lib/coach/types";
import type { WearableSnapshot } from "@/lib/data/wearables";

export type RecoverySignal =
  | { kind: "low_recovery"; reason: "elevated_resting_hr" | "low_sleep" | "self_reported" }
  | { kind: "normal" }
  | { kind: "insufficient_data" };

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

// Pure function mirroring block-change-gate.ts's exact shape — only ever
// feeds a member-confirmed suggestion (applyRecoveryAdjustment in
// workout-session.ts), never an autonomous change, which is what makes
// the invented thresholds in types.ts acceptable. `baseline` must already
// exclude today (see getRecentWearableSnapshots) so today is never
// compared against itself. Each metric is averaged only over the days
// where the wearable actually reported it — a day Google Health didn't
// return sleep for doesn't drag the sleep baseline toward zero.
export function getRecoverySignal(today: WearableSnapshot, baseline: WearableSnapshot[]): RecoverySignal {
  if (baseline.length < RECOVERY_MIN_BASELINE_DAYS) {
    return { kind: "insufficient_data" };
  }

  const restingHrBaseline = average(baseline.map((b) => b.restingHeartRate));
  if (
    today.restingHeartRate !== null &&
    restingHrBaseline !== null &&
    today.restingHeartRate >= restingHrBaseline + RECOVERY_RESTING_HR_DELTA
  ) {
    return { kind: "low_recovery", reason: "elevated_resting_hr" };
  }

  const sleepBaseline = average(baseline.map((b) => b.sleepMinutes));
  if (today.sleepMinutes !== null && sleepBaseline !== null && today.sleepMinutes <= sleepBaseline - RECOVERY_SLEEP_MINUTES_DELTA) {
    return { kind: "low_recovery", reason: "low_sleep" };
  }

  return { kind: "normal" };
}

// The no-wearable equivalent of getRecoverySignal above — a member's own
// quick self-report (sleep/soreness/energy, 2026-09-06) feeding the exact
// same RecoverySignal union, so the existing low-recovery banner and
// applyRecoveryAdjustment need no changes to handle it. Simple, deliberately
// non-weighted threshold: low energy on its own, or low sleep AND soreness
// together, count as low recovery — energy is the most direct predictor of
// how a session will actually go, while a single low answer elsewhere
// (just poor sleep, or just some soreness) isn't enough on its own to flag
// a session that might otherwise be fine.
export function getSelfReportedRecoverySignal(check: { sleepQuality: ReadinessLevel; soreness: ReadinessLevel; energy: ReadinessLevel }): RecoverySignal {
  if (check.energy === "low" || (check.sleepQuality === "low" && check.soreness === "low")) {
    return { kind: "low_recovery", reason: "self_reported" };
  }
  return { kind: "normal" };
}
