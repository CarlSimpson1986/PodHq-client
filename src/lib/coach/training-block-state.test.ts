import { describe, it, expect } from "vitest";
import { getTrainingBlockState, getActiveBlock, type ActiveBlock } from "./training-block-state";
import type { CoachProfile } from "./coach-profile";

function profile(createdAt: string): CoachProfile {
  return {
    id: 1,
    member_id: 1,
    created_at: createdAt,
    goal: "muscle_gain",
    experience_level: "intermediate",
    injuries: null,
    sessions_per_week: 4,
    weight_kg: 80,
    height_cm: 180,
    age: 30,
    daily_activity_level: "moderately_active",
    meal_count_preference: null,
    food_allergies: null,
    food_preferences: null,
    nutrition_tracking_mode: "calorie_counting",
  };
}

describe("getActiveBlock", () => {
  it("returns the implicit Block 1 (hypertrophy) anchored to coach_profiles.created_at when there's no history", () => {
    const p = profile("2026-06-01T00:00:00Z");
    expect(getActiveBlock(p, [])).toEqual({ blockType: "hypertrophy", startedAt: "2026-06-01T00:00:00Z" });
  });

  it("returns the most recent history row when one exists", () => {
    const p = profile("2026-06-01T00:00:00Z");
    const history: ActiveBlock[] = [
      { blockType: "deload", startedAt: "2026-08-24T00:00:00Z" },
      { blockType: "hypertrophy", startedAt: "2026-06-01T00:00:00Z" },
    ];
    expect(getActiveBlock(p, history)).toEqual(history[0]);
  });
});

describe("getTrainingBlockState", () => {
  it("returns no_profile when there's no coach profile yet", () => {
    expect(getTrainingBlockState(null, [], new Date("2026-08-26T12:00:00Z"))).toEqual({ kind: "no_profile" });
  });

  it("counts down correctly mid-way through the implicit Block 1", () => {
    const p = profile("2026-06-01T00:00:00Z"); // 84-day (12-week) hypertrophy block
    const now = new Date("2026-06-15T12:00:00Z"); // 14 days in
    const result = getTrainingBlockState(p, [], now);
    expect(result).toEqual({ kind: "in_block", blockType: "hypertrophy", startedAt: "2026-06-01T00:00:00Z", weeksRemaining: 10, daysRemaining: 70 });
  });

  it("flags transition_due once the 12-week hypertrophy block has run its course, scheduling deload next", () => {
    const p = profile("2026-06-01T00:00:00Z");
    const now = new Date("2026-08-24T09:00:00Z"); // exactly 84 days later
    const result = getTrainingBlockState(p, [], now);
    expect(result).toEqual({ kind: "transition_due", currentBlockType: "hypertrophy", scheduledNextBlockType: "deload" });
  });

  it("schedules strength next when a deload followed a hypertrophy block", () => {
    const p = profile("2026-06-01T00:00:00Z");
    const history: ActiveBlock[] = [
      { blockType: "deload", startedAt: "2026-08-24T00:00:00Z" }, // 1-week deload
      { blockType: "hypertrophy", startedAt: "2026-06-01T00:00:00Z" },
    ];
    const now = new Date("2026-08-31T09:00:00Z"); // exactly 7 days into the deload
    const result = getTrainingBlockState(p, history, now);
    expect(result).toEqual({ kind: "transition_due", currentBlockType: "deload", scheduledNextBlockType: "strength" });
  });

  it("schedules hypertrophy next when a deload followed a strength block", () => {
    const p = profile("2026-06-01T00:00:00Z");
    const history: ActiveBlock[] = [
      { blockType: "deload", startedAt: "2026-08-24T00:00:00Z" },
      { blockType: "strength", startedAt: "2026-06-01T00:00:00Z" },
    ];
    const now = new Date("2026-08-31T09:00:00Z");
    const result = getTrainingBlockState(p, history, now);
    expect(result).toEqual({ kind: "transition_due", currentBlockType: "deload", scheduledNextBlockType: "hypertrophy" });
  });

  it("stays in_block for a deload that hasn't run its shorter 1-week duration yet", () => {
    const p = profile("2026-06-01T00:00:00Z");
    const history: ActiveBlock[] = [
      { blockType: "deload", startedAt: "2026-08-24T00:00:00Z" },
      { blockType: "hypertrophy", startedAt: "2026-06-01T00:00:00Z" },
    ];
    const now = new Date("2026-08-27T09:00:00Z"); // 3 days into the deload
    const result = getTrainingBlockState(p, history, now);
    expect(result).toEqual({ kind: "in_block", blockType: "deload", startedAt: "2026-08-24T00:00:00Z", weeksRemaining: 1, daysRemaining: 4 });
  });
});
