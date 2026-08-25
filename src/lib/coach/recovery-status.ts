import "server-only";
import { getWearableConnection, getRecentWearableSnapshots, getLatestWearableSnapshot } from "@/lib/data/wearables";
import { getRecoverySignal, type RecoverySignal } from "@/lib/coach/recovery-signal";
import { RECOVERY_MIN_BASELINE_DAYS } from "@/lib/coach/types";

// Dashboard/Health-tab display status — a superset of RecoverySignal that
// also carries the "day X of 5" baseline count so the UI can show real
// calibration progress instead of a blank/confusing "insufficient_data".
// Deliberately separate from getRecoveryAdvice (workout-session.ts), which
// stays untouched — that one gates the actual workout weight-adjustment
// suggestion and is already shipped/migration-applied; this one is purely
// for display and must never influence training logic.
export type RecoveryStatus =
  | { kind: "not_connected" }
  | { kind: "calibrating"; baselineDays: number; baselineDaysNeeded: number }
  | RecoverySignal;

export async function getRecoveryStatus(memberId: number): Promise<RecoveryStatus> {
  const connection = await getWearableConnection(memberId);
  if (!connection) return { kind: "not_connected" };

  const baseline = await getRecentWearableSnapshots(memberId);
  if (baseline.length < RECOVERY_MIN_BASELINE_DAYS) {
    return { kind: "calibrating", baselineDays: baseline.length, baselineDaysNeeded: RECOVERY_MIN_BASELINE_DAYS };
  }

  const today = await getLatestWearableSnapshot(memberId);
  if (!today) {
    return { kind: "calibrating", baselineDays: baseline.length, baselineDaysNeeded: RECOVERY_MIN_BASELINE_DAYS };
  }

  return getRecoverySignal(today, baseline);
}
