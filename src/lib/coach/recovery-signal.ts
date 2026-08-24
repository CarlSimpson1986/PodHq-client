import {
  RECOVERY_MIN_BASELINE_DAYS,
  RECOVERY_RESTING_HR_DELTA,
  RECOVERY_SLEEP_MINUTES_DELTA,
} from "@/lib/coach/types";
import type { WearableSnapshot } from "@/lib/data/wearables";

export type RecoverySignal =
  | { kind: "low_recovery"; reason: "elevated_resting_hr" | "low_sleep" }
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
