import { describe, it, expect } from "vitest";
import { getWeeklyRecommendation } from "./weekly-recommendation";
import type { CheckInState } from "./checkin-state";
import type { RecoveryStatus } from "./recovery-status";
import type { WeeklyReview } from "./weekly-review";

const NOT_DUE: CheckInState = { kind: "not_due", daysRemaining: 3, nextDueDate: "2026-09-06" };
const NORMAL_RECOVERY: RecoveryStatus = { kind: "normal" };

function review(overrides: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    periodStart: "2026-08-17",
    periodEnd: "2026-08-23",
    sessionsCompleted: 3,
    totalVolumeKg: 5000,
    nutritionDaysLogged: 6,
    nutritionDaysInWindow: 7,
    avgDailyCalories: 2200,
    avgDailyProteinG: 160,
    avgDailyCarbsG: 200,
    avgDailyFatG: 70,
    targets: { calories: 2200, proteinG: 160, fatG: 70, carbsG: 200 },
    totalSteps: 70000,
    avgRestingHeartRate: 60,
    avgSleepMinutes: 420,
    wearableDaysSynced: 7,
    ...overrides,
  };
}

describe("getWeeklyRecommendation", () => {
  it("prioritises completing an overdue check-in above everything else", () => {
    const result = getWeeklyRecommendation({ kind: "overdue", daysOverdue: 2 }, 3, 3, NORMAL_RECOVERY, review(), "Sleep by 10pm");
    expect(result.kind).toBe("complete_checkin");
  });

  it("flags hitting the session target before recovery or the member's habit", () => {
    const result = getWeeklyRecommendation(NOT_DUE, 1, 3, { kind: "low_recovery", reason: "low_sleep" }, review(), "Sleep by 10pm");
    expect(result.kind).toBe("hit_sessions");
  });

  it("flags low recovery even when the member has a stated habit", () => {
    const result = getWeeklyRecommendation(NOT_DUE, 3, 3, { kind: "low_recovery", reason: "elevated_resting_hr" }, review(), "Sleep by 10pm");
    expect(result.kind).toBe("prioritise_sleep");
  });

  it("surfaces the member's stated habit once sessions/recovery are clear", () => {
    const result = getWeeklyRecommendation(NOT_DUE, 3, 3, NORMAL_RECOVERY, review({ nutritionDaysLogged: 2 }), "Sleep by 10pm");
    expect(result).toEqual({ kind: "member_habit", habit: "Sleep by 10pm", reason: expect.any(String) });
  });

  it("falls through to log_nutrition when there's no stated habit", () => {
    const result = getWeeklyRecommendation(NOT_DUE, 3, 3, NORMAL_RECOVERY, review({ nutritionDaysLogged: 2 }), null);
    expect(result.kind).toBe("log_nutrition");
  });

  it("falls through to hit_protein when nutrition logging is fine but protein is low", () => {
    const result = getWeeklyRecommendation(NOT_DUE, 3, 3, NORMAL_RECOVERY, review({ avgDailyProteinG: 100 }), null);
    expect(result.kind).toBe("hit_protein");
  });

  it("returns the honest on_track default when nothing is flagged and no habit is set", () => {
    const result = getWeeklyRecommendation(NOT_DUE, 3, 3, NORMAL_RECOVERY, review(), null);
    expect(result.kind).toBe("on_track");
  });
});
