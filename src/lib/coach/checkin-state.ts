import { londonDateParts, londonMidnight, addLondonDays, londonDateString } from "@/lib/london-time";
import type { CoachProfile } from "@/lib/coach/coach-profile";
import { CHECK_IN_DAY_OF_WEEK, CHECK_IN_GRACE_DAYS } from "@/lib/coach/types";

export type CheckInState =
  | { kind: "no_profile" }
  | { kind: "not_due"; daysRemaining: number; nextDueDate: string }
  | { kind: "due" }
  | { kind: "overdue"; daysOverdue: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayOfWeek(instant: Date): number {
  const { year, month, day } = londonDateParts(instant);
  // Day-of-week for a Y-M-D triple doesn't depend on timezone — building
  // via Date.UTC and reading getUTCDay() avoids re-introducing the exact
  // local-vs-UTC drift london-time.ts's own header comment warns against.
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Most recent CHECK_IN_DAY_OF_WEEK on or before `instant`'s London
// calendar date (today itself, if today is the day).
function mostRecentCheckInDay(instant: Date): Date {
  const diff = (dayOfWeek(instant) - CHECK_IN_DAY_OF_WEEK + 7) % 7;
  return addLondonDays(instant, -diff);
}

// Both sides are snapped to London midnight first, so the difference is
// always an exact whole number of days — no DST fractional-day rounding
// ambiguity to worry about.
function daysBetweenMidnights(from: Date, to: Date): number {
  return Math.round((londonMidnight(to).getTime() - londonMidnight(from).getTime()) / MS_PER_DAY);
}

// Fixed weekly cadence (CHECK_IN_DAY_OF_WEEK, e.g. Sunday), not rolling
// from the last completion — see types.ts's CHECK_IN_DAY_OF_WEEK comment
// for why. Pure function mirroring trial-state.ts's discriminated-union
// pattern exactly: the caller fetches coachProfile + the member's most
// recent check_ins row, this function just derives what the UI shows.
export function getCheckInDueState(
  coachProfile: CoachProfile | null,
  lastCheckIn: { completedAt: string } | null,
  now: Date
): CheckInState {
  if (!coachProfile) return { kind: "no_profile" };

  const lastDueDay = mostRecentCheckInDay(now);
  const profileCreatedMidnight = londonMidnight(new Date(coachProfile.created_at));

  // No full weekly period has elapsed since they set up coaching yet —
  // the first check-in should never be "overdue" for a week that
  // predates them. A member's very first week is a partial week, same
  // accepted quirk as any calendar-anchored program.
  if (lastDueDay.getTime() < profileCreatedMidnight.getTime()) {
    const nextDueDay = addLondonDays(lastDueDay, 7);
    return {
      kind: "not_due",
      daysRemaining: Math.max(1, daysBetweenMidnights(now, nextDueDay)),
      nextDueDate: londonDateString(nextDueDay),
    };
  }

  const completedThisPeriod = lastCheckIn !== null && new Date(lastCheckIn.completedAt).getTime() >= lastDueDay.getTime();
  if (completedThisPeriod) {
    const nextDueDay = addLondonDays(lastDueDay, 7);
    return {
      kind: "not_due",
      daysRemaining: Math.max(1, daysBetweenMidnights(now, nextDueDay)),
      nextDueDate: londonDateString(nextDueDay),
    };
  }

  const daysSinceDue = daysBetweenMidnights(lastDueDay, now);
  // A real coach doesn't treat one day late as urgent — only a
  // genuinely-gone-quiet member gets the more urgent "overdue" styling.
  if (daysSinceDue <= CHECK_IN_GRACE_DAYS) {
    return { kind: "due" };
  }
  return { kind: "overdue", daysOverdue: daysSinceDue };
}

// The [periodStart, periodEnd] window a completed-now check-in would
// cover — a full Mon-Sun week ending on the most recent due day.
export function currentCheckInPeriod(now: Date): { periodStart: string; periodEnd: string } {
  const periodEnd = mostRecentCheckInDay(now);
  const periodStart = addLondonDays(periodEnd, -6);
  return { periodStart: londonDateString(periodStart), periodEnd: londonDateString(periodEnd) };
}
