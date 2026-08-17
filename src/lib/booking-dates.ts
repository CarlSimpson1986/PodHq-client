// Shared between the server page (parses/validates the ?date= param) and
// the client day-toggle strip (builds the same window and Link targets) —
// both need to agree on exactly the same day range and string format.

import { addLondonDays, londonDateParts, londonMidnight, londonWallTimeToUtc } from "@/lib/london-time";

// A full month ahead, not just the next 7 days like the first pass — with
// only 8 days the strip never actually overflowed its container on a
// normal screen, so "scroll to see more days" had nothing to scroll to.
export const BOOKING_WINDOW_DAYS = 30;

// All local Date accessors (getFullYear/getDate/setHours/etc.) below are
// deliberately avoided in favour of the Europe/London-pinned helpers — see
// london-time.ts's own comment for why: this exact bug (React error #418,
// found live 2026-08-17) only reproduced on the real Vercel deployment,
// never in local testing, because local dev has no server/client timezone
// gap to expose it.
export function formatDateParam(date: Date): string {
  const { year, month, day } = londonDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function startOfToday(): Date {
  return londonMidnight(new Date());
}

/** The bookable days, today first, as Europe/London-midnight Dates. */
export function bookingWindowDates(): Date[] {
  const today = startOfToday();
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => addLondonDays(today, i));
}

/**
 * Parses a `?date=YYYY-MM-DD` param, clamped to today if missing, malformed,
 * or outside the bookable window — a hand-edited URL shouldn't be able to
 * request an arbitrary past/future date, only what the UI itself offers.
 */
export function parseDateParam(raw: string | undefined): Date {
  const today = startOfToday();
  if (!raw) return today;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return today;

  const parsed = londonWallTimeToUtc(Number(match[1]), Number(match[2]), Number(match[3]), 0);
  if (Number.isNaN(parsed.getTime())) return today;

  const window = bookingWindowDates();
  const inWindow = window.some((d) => d.getTime() === parsed.getTime());
  return inWindow ? parsed : today;
}
