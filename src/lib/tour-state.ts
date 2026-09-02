"use client";

// Cross-page tour progress — sessionStorage, not a DB column: this is
// purely "which step comes next after a client-side navigation," never
// needed once the tab closes or the tour finishes. Deliberately separate
// from `tour_completed_at` (the DB flag for "has this member ever seen
// the welcome"), which TourRunner still updates via the existing
// /api/member/tour-complete route when the whole sequence ends.
const KEY = "podAssistTourResumeIndex";

export function getTourResumeIndex(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export function setTourResumeIndex(index: number) {
  window.sessionStorage.setItem(KEY, String(index));
}

export function clearTourResume() {
  window.sessionStorage.removeItem(KEY);
}
