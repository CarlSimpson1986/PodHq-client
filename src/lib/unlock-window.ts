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

export function isWithinUnlockWindow(now: number, slotStartMs: number, slotDurationMinutes: number): boolean {
  return now >= slotStartMs - UNLOCK_WINDOW_BEFORE_MS && now <= slotStartMs + unlockWindowAfterMs(slotDurationMinutes);
}
