import { describe, it, expect } from "vitest";
import { computeWearableWeeklyReflection } from "./weekly-wearable-reflection";
import type { WearableSnapshot } from "@/lib/data/wearables";

function snapshot(overrides: Partial<WearableSnapshot> = {}): WearableSnapshot {
  return { recordedDate: "2026-08-01", steps: 8000, sleepMinutes: 420, restingHeartRate: 60, hrvMs: 55, ...overrides };
}

function baselineDays(count: number, overrides: Partial<WearableSnapshot> = {}): WearableSnapshot[] {
  return Array.from({ length: count }, () => snapshot(overrides));
}

describe("computeWearableWeeklyReflection", () => {
  it("returns nothing below the minimum baseline sample", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: 300, avgRestingHeartRate: 70 }, baselineDays(4));
    expect(result).toEqual([]);
  });

  it("returns nothing when this week is in line with the baseline", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: 420, avgRestingHeartRate: 60 }, baselineDays(7));
    expect(result).toEqual([]);
  });

  it("flags sleep down when this week is well under the baseline", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: 350, avgRestingHeartRate: null }, baselineDays(7)); // baseline 420 - delta 60
    expect(result).toEqual([{ metric: "sleep", direction: "down", text: expect.any(String) }]);
  });

  it("flags sleep up when this week is well over the baseline", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: 490, avgRestingHeartRate: null }, baselineDays(7)); // baseline 420 + delta 60
    expect(result).toEqual([{ metric: "sleep", direction: "up", text: expect.any(String) }]);
  });

  it("flags resting heart rate up (the concerning direction) when elevated over baseline", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: null, avgRestingHeartRate: 66 }, baselineDays(7)); // baseline 60 + delta 5
    expect(result).toEqual([{ metric: "resting_hr", direction: "up", text: expect.any(String) }]);
  });

  it("flags resting heart rate down (the positive direction) when well under baseline", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: null, avgRestingHeartRate: 54 }, baselineDays(7)); // baseline 60 - delta 5
    expect(result).toEqual([{ metric: "resting_hr", direction: "down", text: expect.any(String) }]);
  });

  it("can flag both metrics at once", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: 350, avgRestingHeartRate: 66 }, baselineDays(7));
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.metric).sort()).toEqual(["resting_hr", "sleep"]);
  });

  it("ignores a null this-week value even with a valid baseline", () => {
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: null, avgRestingHeartRate: null }, baselineDays(7));
    expect(result).toEqual([]);
  });

  it("averages only the baseline days that actually reported a metric", () => {
    const baseline = [...baselineDays(5, { sleepMinutes: 420 }), ...baselineDays(5, { sleepMinutes: null })];
    const result = computeWearableWeeklyReflection({ avgSleepMinutes: 350, avgRestingHeartRate: null }, baseline);
    expect(result).toEqual([{ metric: "sleep", direction: "down", text: expect.any(String) }]);
  });
});
