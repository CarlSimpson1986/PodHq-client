// Building/reading booking-grid Date objects via local Date methods
// (setHours/getHours/getDate/etc.) uses whatever timezone the executing
// machine happens to be in. That's fine when server and client are the same
// machine (local dev), but breaks for real: Vercel's serverless functions
// run in UTC internally regardless of region pin (same root cause
// documented for the self-service bookable-hours check, podHq's ROADMAP
// Stage 15), while a UK member's browser is Europe/London (BST for half the
// year). A "use client" component's initial render still happens once
// server-side (SSR, in UTC) and once again during client hydration (in
// BST) — if the Date objects/accessors disagree between those two, the
// rendered HTML disagrees too, which is a genuine hydration mismatch
// (React error #418), not a false alarm. Found live 2026-08-17: this was
// masked in every local test (dev server and `next build && next start`
// both run on the same machine as the test browser, so there's no
// server/client timezone gap to expose it) and only reproduced on the real
// Vercel deployment.
//
// Fix: never use local Date accessors (get/setHours, getDate, etc.) on a
// booking slot's Date object anywhere in render logic — always go through
// these helpers, which read/build wall-clock components via
// Intl.DateTimeFormat pinned to Europe/London, the same pattern already
// established in src/lib/pods/bookable-hours.ts.

const LONDON_TZ = "Europe/London";

interface LondonParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number; // 0-59
}

function londonParts(instant: Date): LondonParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/**
 * The UTC instant for a given Europe/London wall-clock date+hour(+minute) —
 * correct across the BST transition, unlike `new Date(y, m, d, h)` (machine-
 * local timezone) or naive UTC arithmetic (wrong by an hour for half the
 * year). Two-pass fixed point: a plain UTC guess is always within an hour of
 * correct (UK's offset from UTC is only ever 0 or 1 hour), so reading the
 * guess's actual London offset and correcting once is always enough.
 */
export function londonWallTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const seenAsLondon = londonParts(guess);
  const guessLondonHourAsUtc = Date.UTC(
    seenAsLondon.year,
    seenAsLondon.month - 1,
    seenAsLondon.day,
    seenAsLondon.hour,
    seenAsLondon.minute
  );
  const offsetMs = guessLondonHourAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

/** `instant`'s calendar date and wall-clock hour, as they read in Europe/London. */
export function londonDateParts(instant: Date): { year: number; month: number; day: number } {
  const { year, month, day } = londonParts(instant);
  return { year, month, day };
}

/** The wall-clock hour (0-23) `instant` falls on in Europe/London. */
export function londonHourOf(instant: Date): number {
  return londonParts(instant).hour;
}

/** Midnight Europe/London on the calendar day `instant` falls on. */
export function londonMidnight(instant: Date): Date {
  const { year, month, day } = londonDateParts(instant);
  return londonWallTimeToUtc(year, month, day, 0);
}

/** `instant`'s Europe/London calendar day, shifted by `days` (handles month/year rollover and DST). */
export function addLondonDays(instant: Date, days: number): Date {
  const { year, month, day } = londonDateParts(instant);
  return londonWallTimeToUtc(year, month, day + days, 0);
}

/** The UTC instant for a specific wall-clock hour(+minute) on the same Europe/London calendar day as `dayInstant`. */
export function londonHour(dayInstant: Date, hour: number, minute = 0): Date {
  const { year, month, day } = londonDateParts(dayInstant);
  return londonWallTimeToUtc(year, month, day, hour, minute);
}
