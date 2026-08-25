// Nudge once a member's gone this many times their own normal gap
// between sessions (7 / sessions_per_week) without training — a 4x/week
// member and a 1x/week member both get flagged at "twice as long as
// their own usual pace", not the same flat number of days. See
// training-nudge/route.ts for the full reasoning.
const GRACE_MULTIPLIER = 2;
// Never nudge sooner than this, even for a very high-frequency member —
// missing a long weekend shouldn't trigger a guilt email.
const MIN_NUDGE_DAYS = 4;
// Cap so this never fires later than win-back's own 21-day catch-all.
const MAX_NUDGE_DAYS = 21;

export function trainingNudgeThresholdDays(sessionsPerWeek: number): number {
  const expectedGapDays = 7 / sessionsPerWeek;
  return Math.min(MAX_NUDGE_DAYS, Math.max(MIN_NUDGE_DAYS, expectedGapDays * GRACE_MULTIPLIER));
}
