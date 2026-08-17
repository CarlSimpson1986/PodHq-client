import { describe, expect, it } from "vitest";
import { addLondonDays, londonDateParts, londonHour, londonHourOf, londonMidnight, londonWallTimeToUtc } from "./london-time";

describe("londonWallTimeToUtc", () => {
  it("returns UTC+0 offset in winter (GMT)", () => {
    // 2026-01-15 09:00 London (GMT) == 09:00 UTC
    const d = londonWallTimeToUtc(2026, 1, 15, 9);
    expect(d.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("returns UTC+1 offset in summer (BST)", () => {
    // 2026-08-17 09:00 London (BST) == 08:00 UTC
    const d = londonWallTimeToUtc(2026, 8, 17, 9);
    expect(d.toISOString()).toBe("2026-08-17T08:00:00.000Z");
  });
});

describe("londonMidnight / londonDateParts round-trip", () => {
  it("midnight London on a BST day reads back as hour 0 in London regardless of host timezone", () => {
    const midnight = londonMidnight(new Date("2026-08-17T15:30:00Z"));
    expect(londonHourOf(midnight)).toBe(0);
    expect(londonDateParts(midnight)).toEqual({ year: 2026, month: 8, day: 17 });
    // The actual UTC instant is 1 hour earlier than naive UTC midnight, since BST is UTC+1.
    expect(midnight.toISOString()).toBe("2026-08-16T23:00:00.000Z");
  });
});

describe("addLondonDays", () => {
  it("carries across the BST->GMT clock change without drifting a day", () => {
    // 29 Oct 2026 is the last Sunday in October — clocks go back that night.
    const before = londonMidnight(new Date("2026-10-29T00:00:00Z"));
    const after = addLondonDays(before, 1);
    expect(londonDateParts(after)).toEqual({ year: 2026, month: 10, day: 30 });
    expect(londonHourOf(after)).toBe(0);
  });

  it("rolls over month and year boundaries correctly", () => {
    const dec31 = londonMidnight(new Date("2026-12-31T12:00:00Z"));
    const jan1 = addLondonDays(dec31, 1);
    expect(londonDateParts(jan1)).toEqual({ year: 2027, month: 1, day: 1 });
  });
});

describe("londonHour", () => {
  it("builds each hour of a BST day at the correct UTC instant", () => {
    const day = londonMidnight(new Date("2026-08-17T00:00:00Z"));
    const seventeen = londonHour(day, 17);
    expect(londonHourOf(seventeen)).toBe(17);
    expect(seventeen.toISOString()).toBe("2026-08-17T16:00:00.000Z");
  });
});
