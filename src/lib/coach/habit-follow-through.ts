export interface FollowThroughCheckIn {
  habitFollowUp: "yes" | "partially" | "no" | null;
}

export interface HabitFollowThroughStat {
  madeProgress: number;
  total: number;
}

// How many of the most recent answered check-ins feed the stat — 8 weeks
// (2 months) is recent enough to feel like "how am I actually doing
// lately" rather than a lifetime average diluted by an old bad patch, and
// matches this codebase's own convention of small, deliberately-chosen
// trailing windows (see block-progress.ts's RECENT_RPE_SAMPLE_SIZE).
const FOLLOW_THROUGH_WINDOW = 8;

// Client-perspective review, 2026-08-30 — habitFollowUp ("did you keep
// last week's commitment up?") was collected and only ever used once, in
// that single week's coach response. This rolls it into a real stat — "3
// of your last 5" — the accountability signal a member actually asked to
// see, not just a one-off line in a paragraph they may not have read.
//
// "yes" and "partially" both count as progress, not just "yes" — a real
// coach counts a partial effort as real effort, not a failure; "no" is
// the only genuine miss. Pure — input must already be sorted most-recent-
// first (getRecentCheckIns' own ordering). Check-ins with no
// habitFollowUp answer (the member's very first ever, which has nothing
// to follow up on) are skipped entirely rather than counted as a miss —
// there was nothing to have kept up with.
export function computeHabitFollowThrough(checkIns: FollowThroughCheckIn[]): HabitFollowThroughStat | null {
  const answered = checkIns.filter((c) => c.habitFollowUp !== null).slice(0, FOLLOW_THROUGH_WINDOW);
  if (answered.length === 0) return null;

  const madeProgress = answered.filter((c) => c.habitFollowUp === "yes" || c.habitFollowUp === "partially").length;
  return { madeProgress, total: answered.length };
}
