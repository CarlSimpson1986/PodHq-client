import { londonHour } from "@/lib/london-time";

// The window during which a booking's Unlock is actually available: from
// 5 minutes before the slot starts, through the slot's own duration plus a
// 5-minute grace period after. Previously hardcoded as a flat 65 minutes
// (60min slot + 5min grace) independently in booking-grid.tsx (twice),
// bookings-view.tsx, api/unlock/route.ts, and upcoming-session-card.tsx —
// correct only for a 60-minute resource. Hove's Wellness Room (30-minute
// slots) exposed this: the door stayed unlockable for 35 minutes longer
// than the actual session. Consolidated here so every call site derives
// the window from the resource's own slotDurationMinutes instead of a
// copy-pasted assumption that can silently go stale for a new resource
// type — same reasoning podHq's resolveGym() consolidation already
// documented for this exact class of bug.
export const UNLOCK_WINDOW_BEFORE_MS = 5 * 60 * 1000;
const GRACE_AFTER_MS = 5 * 60 * 1000;

export function unlockWindowAfterMs(slotDurationMinutes: number): number {
  return slotDurationMinutes * 60 * 1000 + GRACE_AFTER_MS;
}

// Never before the gym's opening hour (Europe/London) on the slot's day.
// Hove's PDK access rule only allows 06:00-22:00 (the gym can't operate
// outside those hours), so a 6am booking tapping at 05:55 got through our
// window and then PDK's "Outside of scheduled access" 403 — found
// 2026-10-15. openHour omitted or 0 (open from midnight, e.g. a 24-hour
// gym) = no clamp, so a midnight slot keeps its 23:55 early unlock.
export function unlockWindowOpensAtMs(slotStartMs: number, openHour?: number): number {
  const early = slotStartMs - UNLOCK_WINDOW_BEFORE_MS;
  if (!openHour) return early;
  const opensAt = londonHour(new Date(slotStartMs), openHour).getTime();
  // Never later than the slot itself: a slot booked before the opening hour
  // was moved later would otherwise have its window pushed past its own end
  // and never be unlockable at all (2026-11-14 review).
  return Math.max(early, Math.min(opensAt, slotStartMs));
}

// Same clamp at the other end: never after the gym's closing hour on the
// slot's day, since PDK's access rule ends there too — a 21:00 slot tapping
// Unlock at 22:02 got through our 5-minute grace and then PDK's 403
// (2026-11-14 review). closeHour omitted or >= 24 = no clamp. Never earlier
// than the slot's own end, for the same moved-hours reason as above.
export function unlockWindowClosesAtMs(slotStartMs: number, slotDurationMinutes: number, closeHour?: number): number {
  const late = slotStartMs + unlockWindowAfterMs(slotDurationMinutes);
  if (closeHour === undefined || closeHour >= 24) return late;
  const closesAt = londonHour(new Date(slotStartMs), closeHour).getTime();
  const slotEnd = slotStartMs + slotDurationMinutes * 60 * 1000;
  return Math.min(late, Math.max(closesAt, slotEnd));
}

export function isWithinUnlockWindow(
  now: number,
  slotStartMs: number,
  slotDurationMinutes: number,
  openHour?: number,
  closeHour?: number
): boolean {
  return (
    now >= unlockWindowOpensAtMs(slotStartMs, openHour) &&
    now <= unlockWindowClosesAtMs(slotStartMs, slotDurationMinutes, closeHour)
  );
}
