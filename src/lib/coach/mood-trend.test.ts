import { describe, it, expect } from "vitest";
import { computeMoodTrend } from "./mood-trend";

describe("computeMoodTrend", () => {
  it("returns none for no check-ins", () => {
    expect(computeMoodTrend([])).toEqual({ kind: "none" });
  });

  it("returns none for a single Rough week — one bad week isn't a trend", () => {
    expect(computeMoodTrend([{ periodStart: "2026-08-23", weekFeel: 1 }])).toEqual({ kind: "none" });
  });

  it("returns none when the most recent week is OK or better", () => {
    const checkIns = [
      { periodStart: "2026-08-23", weekFeel: 3 },
      { periodStart: "2026-08-16", weekFeel: 1 },
      { periodStart: "2026-08-09", weekFeel: 1 },
    ];
    expect(computeMoodTrend(checkIns)).toEqual({ kind: "none" });
  });

  it("flags three consecutive Rough/Tough weeks", () => {
    const checkIns = [
      { periodStart: "2026-08-23", weekFeel: 2 },
      { periodStart: "2026-08-16", weekFeel: 1 },
      { periodStart: "2026-08-09", weekFeel: 2 },
    ];
    expect(computeMoodTrend(checkIns)).toEqual({ kind: "low", consecutiveWeeks: 3 });
  });

  it("stops counting at the first week that isn't low", () => {
    const checkIns = [
      { periodStart: "2026-08-23", weekFeel: 1 },
      { periodStart: "2026-08-16", weekFeel: 1 },
      { periodStart: "2026-08-09", weekFeel: 4 }, // would extend to 3 if not for this
      { periodStart: "2026-08-02", weekFeel: 1 },
    ];
    expect(computeMoodTrend(checkIns)).toEqual({ kind: "none" });
  });

  it("stops at a skipped week (period gap greater than 7 days)", () => {
    const checkIns = [
      { periodStart: "2026-08-23", weekFeel: 1 },
      { periodStart: "2026-08-16", weekFeel: 1 },
      { periodStart: "2026-07-26", weekFeel: 1 }, // 3 weeks earlier, not 1
    ];
    expect(computeMoodTrend(checkIns)).toEqual({ kind: "none" });
  });

  it("keeps counting past three for a longer streak", () => {
    const checkIns = [
      { periodStart: "2026-08-23", weekFeel: 2 },
      { periodStart: "2026-08-16", weekFeel: 1 },
      { periodStart: "2026-08-09", weekFeel: 2 },
      { periodStart: "2026-08-02", weekFeel: 1 },
    ];
    expect(computeMoodTrend(checkIns)).toEqual({ kind: "low", consecutiveWeeks: 4 });
  });
});
