import { describe, expect, it } from "vitest";
import { isWithinUnlockWindow, unlockWindowClosesAtMs, unlockWindowOpensAtMs } from "./unlock-window";

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

  it("never opens later than the slot itself, even if opening hours moved later", () => {
    // 06:00 BST slot booked before open_hour changed to 7
    expect(unlockWindowOpensAtMs(sixAmBst, 7)).toBe(sixAmBst);
    expect(isWithinUnlockWindow(sixAmBst + 10 * MIN, sixAmBst, 30, 7, 22)).toBe(true);
  });
});

describe("unlock window closing-hour clamp", () => {
  const ninePmBst = Date.parse("2026-10-16T20:00:00Z"); // 21:00 BST
  const tenPmBst = ninePmBst + 60 * MIN;

  it("doesn't stay open past closing for the last slot of the day", () => {
    expect(unlockWindowClosesAtMs(ninePmBst, 60, 22)).toBe(tenPmBst);
    expect(isWithinUnlockWindow(tenPmBst, ninePmBst, 60, 6, 22)).toBe(true);
    expect(isWithinUnlockWindow(tenPmBst + 2 * MIN, ninePmBst, 60, 6, 22)).toBe(false);
  });

  it("keeps the 5-minute grace for earlier slots", () => {
    const threePm = Date.parse("2026-10-16T14:00:00Z");
    expect(isWithinUnlockWindow(threePm + 65 * MIN, threePm, 60, 6, 22)).toBe(true);
  });

  it("works after the clocks go back (GMT)", () => {
    const ninePmGmt = Date.parse("2026-11-03T21:00:00Z");
    expect(isWithinUnlockWindow(ninePmGmt + 62 * MIN, ninePmGmt, 60, 6, 22)).toBe(false);
    expect(isWithinUnlockWindow(ninePmGmt + 59 * MIN, ninePmGmt, 60, 6, 22)).toBe(true);
  });

  it("never closes before the slot's own end, even if closing hours moved earlier", () => {
    expect(unlockWindowClosesAtMs(ninePmBst, 60, 21)).toBe(tenPmBst);
  });

  it("doesn't clamp with no closing hour or a 24-hour resource", () => {
    expect(unlockWindowClosesAtMs(ninePmBst, 60)).toBe(tenPmBst + 5 * MIN);
    expect(unlockWindowClosesAtMs(ninePmBst, 60, 24)).toBe(tenPmBst + 5 * MIN);
  });
});

