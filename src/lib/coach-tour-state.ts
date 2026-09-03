"use client";

// Cross-page Coach tour progress — sessionStorage, not a DB column, same
// reasoning and shape as tour-state.ts (Pod Assist's own). Separate key
// so the two tours' resume pointers can never collide if somehow both
// were mid-flight in the same tab.
const KEY = "podCoachTourResumeIndex";

export function getCoachTourResumeIndex(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export function setCoachTourResumeIndex(index: number) {
  window.sessionStorage.setItem(KEY, String(index));
}

export function clearCoachTourResume() {
  window.sessionStorage.removeItem(KEY);
}
