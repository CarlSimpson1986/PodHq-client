import { describe, it, expect } from "vitest";
import { averageInWindow } from "./wearable-averages";

const NOW = new Date("2026-08-28T12:00:00Z"); // a London BST Friday

describe("averageInWindow", () => {
  it("returns null for an empty points array", () => {
    expect(averageInWindow([], NOW, 7)) .toBeNull();
  });

  it("averages only points inside the window", () => {
    const points = [
      { date: "2026-08-27", value: 10 },
      { date: "2026-08-28", value: 20 },
      { date: "2026-07-01", value: 1000 }, // well outside a 7-day window
    ];
    expect(averageInWindow(points, NOW, 7)).toBe(15);
  });

  it("includes today and exactly `days` days back (inclusive both ends)", () => {
    const points = [
      { date: "2026-08-21", value: 100 }, // exactly 7 days back
      { date: "2026-08-28", value: 200 }, // today
    ];
    expect(averageInWindow(points, NOW, 7)).toBe(150);
  });

  it("excludes a point one day older than the window", () => {
    const points = [
      { date: "2026-08-20", value: 100 }, // 8 days back — outside a 7-day window
      { date: "2026-08-28", value: 200 },
    ];
    expect(averageInWindow(points, NOW, 7)).toBe(200);
  });

  it("returns null when every point falls outside the window", () => {
    const points = [{ date: "2026-01-01", value: 500 }];
    expect(averageInWindow(points, NOW, 7)).toBeNull();
  });

  it("supports a wider window (e.g. 30 days) independently of a narrower one", () => {
    const points = [
      { date: "2026-08-28", value: 100 },
      { date: "2026-08-05", value: 300 }, // 23 days back — outside 7d, inside 30d
    ];
    expect(averageInWindow(points, NOW, 7)).toBe(100);
    expect(averageInWindow(points, NOW, 30)).toBe(200);
  });
});
