import { describe, it, expect } from "vitest";
import { trainingNudgeThresholdDays } from "./training-nudge-threshold";

describe("trainingNudgeThresholdDays", () => {
  it("nudges a 1x/week member after 14 days (2x their 7-day gap)", () => {
    expect(trainingNudgeThresholdDays(1)).toBe(14);
  });

  it("nudges a 2x/week member after 7 days (2x their 3.5-day gap)", () => {
    expect(trainingNudgeThresholdDays(2)).toBe(7);
  });

  it("floors at MIN_NUDGE_DAYS for a high-frequency member instead of nudging after a couple of days", () => {
    // 7x/week -> expected gap 1 day -> 2x = 2 days, floored to 4.
    expect(trainingNudgeThresholdDays(7)).toBe(4);
  });

  it("caps at MAX_NUDGE_DAYS instead of exceeding win-back's own 21-day catch-all", () => {
    // A very low target would otherwise push the threshold past 21 days.
    expect(trainingNudgeThresholdDays(0.5)).toBe(21);
  });
});
