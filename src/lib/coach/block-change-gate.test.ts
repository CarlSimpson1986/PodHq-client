import { describe, it, expect } from "vitest";
import { getBlockChangeRecommendation } from "./block-change-gate";

describe("getBlockChangeRecommendation", () => {
  it("recommends keep when attendance is below the threshold, regardless of RPE", () => {
    const result = getBlockChangeRecommendation(
      "hypertrophy",
      { completedSessions: 20, weeksElapsed: 12, sessionsPerWeek: 4 }, // 20/48 = 0.42
      [5, 5, 5, 5]
    );
    expect(result).toEqual({ kind: "keep", reason: "low_attendance" });
  });

  it("treats zero weeks elapsed as zero attendance rather than dividing by zero", () => {
    const result = getBlockChangeRecommendation("deload", { completedSessions: 0, weeksElapsed: 0, sessionsPerWeek: 4 }, []);
    expect(result).toEqual({ kind: "keep", reason: "low_attendance" });
  });

  it("shifts to deload with good attendance regardless of RPE — deload never escalates difficulty", () => {
    const result = getBlockChangeRecommendation(
      "deload",
      { completedSessions: 40, weeksElapsed: 12, sessionsPerWeek: 4 }, // 40/48 = 0.83
      [5, 5, 5, 5, 5]
    );
    expect(result).toEqual({ kind: "shift", nextBlockType: "deload" });
  });

  // Corrected 2026-08-30 (coaching review) — a thin RPE sample used to
  // silently fall through to "shift" ("no signal" treated the same as "no
  // problem"). Now it holds instead, same as low attendance does.
  it("recommends keep (insufficient data) with good attendance but a thin RPE sample heading into strength", () => {
    const result = getBlockChangeRecommendation(
      "strength",
      { completedSessions: 40, weeksElapsed: 12, sessionsPerWeek: 4 },
      [4, 5] // below BLOCK_MIN_RPE_SAMPLE
    );
    expect(result).toEqual({ kind: "keep", reason: "insufficient_data" });
  });

  it("recommends keep (insufficient data) with zero recent RPE heading into strength", () => {
    const result = getBlockChangeRecommendation("strength", { completedSessions: 40, weeksElapsed: 12, sessionsPerWeek: 4 }, []);
    expect(result).toEqual({ kind: "keep", reason: "insufficient_data" });
  });

  it("shifts to strength with good attendance and low recent RPE", () => {
    const result = getBlockChangeRecommendation("strength", { completedSessions: 40, weeksElapsed: 12, sessionsPerWeek: 4 }, [2, 3, 2, 3]);
    expect(result).toEqual({ kind: "shift", nextBlockType: "strength" });
  });

  it("recommends extending the deload when good attendance meets high recent fatigue heading into strength", () => {
    const result = getBlockChangeRecommendation(
      "strength",
      { completedSessions: 40, weeksElapsed: 12, sessionsPerWeek: 4 },
      [4, 4, 3, 5] // 3/4 = 0.75 hard-or-killer
    );
    expect(result).toEqual({ kind: "extend_deload", reason: "high_fatigue" });
  });
});
