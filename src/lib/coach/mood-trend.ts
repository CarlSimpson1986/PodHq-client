export interface MoodTrendCheckIn {
  periodStart: string;
  weekFeel: number | null;
}

export type MoodTrend = { kind: "low"; consecutiveWeeks: number } | { kind: "none" };

// weekFeel <= 2 is Rough/Tough (WEEK_FEEL_OPTIONS in checkin-view.tsx) —
// the two genuinely negative ratings, not "OK".
const LOW_MOOD_THRESHOLD = 2;
// A single bad week is normal life, not a trend — three in a row is a
// real, deliberately-invented-but-defensible threshold (same category as
// this app's other trailing-window constants, e.g.
// RECOVERY_RESTING_HR_DELTA), Carl's to retune.
const LOW_MOOD_TRIGGER_WEEKS = 3;

// Client-perspective review, 2026-08-30 — weekFeel was captured every
// week and used exactly once, in that week's own coach response, then
// forgotten. A single "Rough" week is just a data point; three Rough/
// Tough weeks in a row is a real signal a human coach would actually
// notice and say something about — arguably a more direct one than the
// wearable-derived recovery signal (recovery-signal.ts), since it's the
// member's own explicit word rather than an inference from sleep/HR data.
//
// Pure function mirroring habit-streak.ts's own walk-back shape exactly
// (same "count back while consecutive, stop at the first gap or
// disqualifying value" pattern) — input must already be sorted most-
// recent-first (getRecentCheckIns' own ordering). Deliberately never an
// autonomous programming change, same posture as every other invented
// threshold in this app (recovery-signal.ts, block-change-gate.ts) — see
// weekly-recommendation.ts's own low_mood case for where this surfaces,
// as a suggestion only.
export function computeMoodTrend(checkIns: MoodTrendCheckIn[]): MoodTrend {
  let consecutive = 0;
  let expectedPeriodStart: string | null = null;

  for (const checkIn of checkIns) {
    if (checkIn.weekFeel === null || checkIn.weekFeel > LOW_MOOD_THRESHOLD) break;
    if (expectedPeriodStart !== null && checkIn.periodStart !== expectedPeriodStart) break;

    consecutive++;
    const prev = new Date(`${checkIn.periodStart}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 7);
    expectedPeriodStart = prev.toISOString().slice(0, 10);
  }

  return consecutive >= LOW_MOOD_TRIGGER_WEEKS ? { kind: "low", consecutiveWeeks: consecutive } : { kind: "none" };
}
