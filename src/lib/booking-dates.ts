// Shared between the server page (parses/validates the ?date= param) and
// the client day-toggle strip (builds the same window and Link targets) —
// both need to agree on exactly the same day range and string format.

// A full month ahead, not just the next 7 days like the first pass — with
// only 8 days the strip never actually overflowed its container on a
// normal screen, so "scroll to see more days" had nothing to scroll to.
export const BOOKING_WINDOW_DAYS = 30;

export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** The bookable days, today first, as local-midnight Dates. */
export function bookingWindowDates(): Date[] {
  const today = startOfToday();
  return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
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

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return today;

  const window = bookingWindowDates();
  const inWindow = window.some((d) => d.getTime() === parsed.getTime());
  return inWindow ? parsed : today;
}
