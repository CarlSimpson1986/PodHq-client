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
  return Math.max(early, londonHour(new Date(slotStartMs), openHour).getTime());
}

export function isWithinUnlockWindow(
  now: number,
  slotStartMs: number,
  slotDurationMinutes: number,
  openHour?: number
): boolean {
  return now >= unlockWindowOpensAtMs(slotStartMs, openHour) && now <= slotStartMs + unlockWindowAfterMs(slotDurationMinutes);
}
