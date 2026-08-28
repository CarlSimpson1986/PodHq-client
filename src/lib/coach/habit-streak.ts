export interface HabitStreakCheckIn {
  periodStart: string;
  habit: string | null;
}

// Pure — input must already be sorted period_start descending (see
// check-ins.ts's getRecentCheckIns). Counts back from the most recent
// check-in while both hold: a non-empty habit was set, and each period
// is exactly 7 days after the next (no skipped week). Stops at the
// first violation of either.
//
// Deliberately "weeks running you've SET a habit", not "weeks running
// you actually KEPT it up" — this app has no way to verify the latter
// without a self-report follow-up question this pass didn't add, and
// this file's whole point is not claiming something unverifiable (same
// principle as check_ins.answers being plain self-report throughout,
// and recovery-signal.ts never inventing a number it can't back).
export function computeHabitStreak(checkIns: HabitStreakCheckIn[]): number {
  let streak = 0;
  let expectedPeriodStart: string | null = null;

  for (const checkIn of checkIns) {
    if (checkIn.habit === null) break;
    if (expectedPeriodStart !== null && checkIn.periodStart !== expectedPeriodStart) break;

    streak++;
    const prev = new Date(`${checkIn.periodStart}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 7);
    expectedPeriodStart = prev.toISOString().slice(0, 10);
  }

  return streak;
}
