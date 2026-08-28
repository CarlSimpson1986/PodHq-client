import { describe, it, expect } from "vitest";
import { computeHabitStreak } from "./habit-streak";

describe("computeHabitStreak", () => {
  it("returns 0 for no check-ins", () => {
    expect(computeHabitStreak([])).toBe(0);
  });

  it("returns 0 when the most recent check-in has no habit set", () => {
    expect(computeHabitStreak([{ periodStart: "2026-08-23", habit: null }])).toBe(0);
  });

  it("counts a single week with a habit set", () => {
    expect(computeHabitStreak([{ periodStart: "2026-08-23", habit: "Sleep by 10pm" }])).toBe(1);
  });

  it("counts consecutive weeks with no gap", () => {
    const checkIns = [
      { periodStart: "2026-08-23", habit: "Sleep by 10pm" },
      { periodStart: "2026-08-16", habit: "Hit protein target" },
      { periodStart: "2026-08-09", habit: "Stretch daily" },
    ];
    expect(computeHabitStreak(checkIns)).toBe(3);
  });

  it("stops at the first week with no habit set", () => {
    const checkIns = [
      { periodStart: "2026-08-23", habit: "Sleep by 10pm" },
      { periodStart: "2026-08-16", habit: null },
      { periodStart: "2026-08-09", habit: "Stretch daily" }, // would extend the streak if not for the gap above
    ];
    expect(computeHabitStreak(checkIns)).toBe(1);
  });

  it("stops at a skipped week (period gap greater than 7 days)", () => {
    const checkIns = [
      { periodStart: "2026-08-23", habit: "Sleep by 10pm" },
      { periodStart: "2026-08-02", habit: "Stretch daily" }, // 3 weeks earlier, not 1 — a missed check-in
    ];
    expect(computeHabitStreak(checkIns)).toBe(1);
  });

  it("does not require the habit text to be identical week to week", () => {
    const checkIns = [
      { periodStart: "2026-08-23", habit: "Sleep by 10pm" },
      { periodStart: "2026-08-16", habit: "A completely different habit" },
    ];
    expect(computeHabitStreak(checkIns)).toBe(2);
  });
});
