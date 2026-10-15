import { describe, expect, it } from "vitest";
import { isWithinUnlockWindow, unlockWindowOpensAtMs } from "./unlock-window";

const MIN = 60 * 1000;

describe("unlock window opening-hour clamp", () => {
  // 6am BST = 05:00Z
  const sixAmBst = Date.parse("2026-10-16T05:00:00Z");
  // 6am GMT = 06:00Z (after the clocks go back on 25 Oct)
  const sixAmGmt = Date.parse("2026-11-03T06:00:00Z");

  it("doesn't open before opening hour for the first slot of the day (BST)", () => {
    expect(unlockWindowOpensAtMs(sixAmBst, 6)).toBe(sixAmBst);
    expect(isWithinUnlockWindow(sixAmBst - 5 * MIN, sixAmBst, 60, 6)).toBe(false);
    expect(isWithinUnlockWindow(sixAmBst - 1, sixAmBst, 60, 6)).toBe(false);
    expect(isWithinUnlockWindow(sixAmBst, sixAmBst, 60, 6)).toBe(true);
  });

  it("doesn't open before opening hour for the first slot of the day (GMT)", () => {
    expect(isWithinUnlockWindow(sixAmGmt - 3 * MIN, sixAmGmt, 60, 6)).toBe(false);
    expect(isWithinUnlockWindow(sixAmGmt, sixAmGmt, 60, 6)).toBe(true);
  });

  it("keeps the 5-minute early unlock for later slots", () => {
    const threePm = Date.parse("2026-10-16T14:00:00Z");
    expect(unlockWindowOpensAtMs(threePm, 6)).toBe(threePm - 5 * MIN);
    expect(isWithinUnlockWindow(threePm - 5 * MIN, threePm, 60, 6)).toBe(true);
  });

  it("leaves the end of the window unchanged", () => {
    expect(isWithinUnlockWindow(sixAmBst + 65 * MIN, sixAmBst, 60, 6)).toBe(true);
    expect(isWithinUnlockWindow(sixAmBst + 65 * MIN + 1, sixAmBst, 60, 6)).toBe(false);
  });

  it("doesn't clamp when no opening hour is given", () => {
    expect(isWithinUnlockWindow(sixAmBst - 5 * MIN, sixAmBst, 60)).toBe(true);
  });

  it("doesn't clamp a 24-hour resource (open_hour 0)", () => {
    const midnight = Date.parse("2026-10-15T23:00:00Z"); // 00:00 BST on 16 Oct
    expect(unlockWindowOpensAtMs(midnight, 0)).toBe(midnight - 5 * MIN);
    expect(isWithinUnlockWindow(midnight - 5 * MIN, midnight, 60, 0)).toBe(true);
  });
});
