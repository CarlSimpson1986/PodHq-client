import { describe, it, expect } from "vitest";
import { getRecoverySignal } from "./recovery-signal";
import type { WearableSnapshot } from "@/lib/data/wearables";

function snapshot(overrides: Partial<WearableSnapshot> = {}): WearableSnapshot {
  return { recordedDate: "2026-08-01", steps: 8000, sleepMinutes: 420, restingHeartRate: 60, ...overrides };
}

function baselineDays(count: number, overrides: Partial<WearableSnapshot> = {}): WearableSnapshot[] {
  return Array.from({ length: count }, () => snapshot(overrides));
}

describe("getRecoverySignal", () => {
  it("returns insufficient_data below the minimum baseline sample", () => {
    const result = getRecoverySignal(snapshot(), baselineDays(4));
    expect(result).toEqual({ kind: "insufficient_data" });
  });

  it("returns normal when today is in line with the baseline", () => {
    const result = getRecoverySignal(snapshot(), baselineDays(7));
    expect(result).toEqual({ kind: "normal" });
  });

  it("flags elevated resting heart rate over the baseline", () => {
    const today = snapshot({ restingHeartRate: 66 }); // baseline 60 + delta 5
    const result = getRecoverySignal(today, baselineDays(7));
    expect(result).toEqual({ kind: "low_recovery", reason: "elevated_resting_hr" });
  });

  it("flags low sleep under the baseline", () => {
    const today = snapshot({ sleepMinutes: 350 }); // baseline 420 - delta 60
    const result = getRecoverySignal(today, baselineDays(7));
    expect(result).toEqual({ kind: "low_recovery", reason: "low_sleep" });
  });

  it("ignores a null metric today rather than treating it as low", () => {
    const today = snapshot({ restingHeartRate: null, sleepMinutes: null });
    const result = getRecoverySignal(today, baselineDays(7));
    expect(result).toEqual({ kind: "normal" });
  });

  it("averages only the baseline days that actually reported a metric", () => {
    const baseline = [...baselineDays(5, { restingHeartRate: 60 }), ...baselineDays(5, { restingHeartRate: null })];
    const today = snapshot({ restingHeartRate: 66 });
    const result = getRecoverySignal(today, baseline);
    expect(result).toEqual({ kind: "low_recovery", reason: "elevated_resting_hr" });
  });
});
