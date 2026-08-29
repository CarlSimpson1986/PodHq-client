import { describe, it, expect } from "vitest";
import { computeNutritionTargets } from "./nutrition-targets";
import type { CoachProfile } from "./coach-profile";

function profile(overrides: Partial<CoachProfile> = {}): CoachProfile {
  return {
    id: 1,
    member_id: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    goal: "fitness",
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
    ...overrides,
  };
}

describe("computeNutritionTargets — Mifflin-St Jeor + daily activity level + goal", () => {
  it("computes calories/protein/fat/carbs for a typical male maintenance profile", () => {
    const result = computeNutritionTargets(profile(), "Male")!;
    expect(result.calories).toBe(2759);
    expect(result.proteinG).toBe(144);
    expect(result.fatG).toBe(84);
    expect(result.carbsG).toBe(356);
  });

  it("returns null when the profile is missing a required body stat or activity level", () => {
    expect(computeNutritionTargets(profile({ weight_kg: null }), "Male")).toBeNull();
    expect(computeNutritionTargets(profile({ height_cm: null }), "Male")).toBeNull();
    expect(computeNutritionTargets(profile({ age: null }), "Male")).toBeNull();
    expect(computeNutritionTargets(profile({ daily_activity_level: null }), "Male")).toBeNull();
  });

  it("averages the male/female formula when gender is null, unset, or non-binary", () => {
    const p = profile({ weight_kg: 70, height_cm: 170, age: 25, sessions_per_week: 3 });
    const male = computeNutritionTargets(p, "Male")!;
    const female = computeNutritionTargets(p, "Female")!;
    const nullGender = computeNutritionTargets(p, null)!;
    const preferNotToSay = computeNutritionTargets(p, "Prefer not to say")!;
    expect(nullGender.calories).toBeGreaterThan(female.calories);
    expect(nullGender.calories).toBeLessThan(male.calories);
    expect(preferNotToSay.calories).toBe(nullGender.calories);
  });

  it("increases calories as daily activity level rises", () => {
    const sedentary = computeNutritionTargets(profile({ daily_activity_level: "sedentary" }), "Male")!;
    const moderate = computeNutritionTargets(profile({ daily_activity_level: "moderately_active" }), "Male")!;
    const extra = computeNutritionTargets(profile({ daily_activity_level: "extra_active" }), "Male")!;
    expect(sedentary.calories).toBeLessThan(moderate.calories);
    expect(moderate.calories).toBeLessThan(extra.calories);
  });

  // Carl's call, 2026-08-29: sessions_per_week is a programming input only
  // (generate-workout.ts) — a single pod session doesn't move total daily
  // burn enough to warrant "eating it back", so it must have zero
  // influence on the calorie target, however it's varied.
  it("gives an identical calorie target regardless of sessions_per_week", () => {
    const low = computeNutritionTargets(profile({ sessions_per_week: 1 }), "Male")!;
    const high = computeNutritionTargets(profile({ sessions_per_week: 6 }), "Male")!;
    expect(low.calories).toBe(high.calories);
  });

  it("gives an office worker and someone doing heavy manual labour different targets", () => {
    const officeWorker = computeNutritionTargets(profile({ daily_activity_level: "sedentary" }), "Male")!;
    const manualLabour = computeNutritionTargets(profile({ daily_activity_level: "extra_active" }), "Male")!;
    expect(manualLabour.calories).toBeGreaterThan(officeWorker.calories);
  });

  it("applies a ~500kcal deficit for weight_loss and a ~300kcal surplus for muscle_gain relative to maintenance", () => {
    const maintenance = computeNutritionTargets(profile({ goal: "fitness" }), "Male")!;
    const deficit = computeNutritionTargets(profile({ goal: "weight_loss" }), "Male")!;
    const surplus = computeNutritionTargets(profile({ goal: "muscle_gain" }), "Male")!;
    expect(maintenance.calories - deficit.calories).toBe(500);
    expect(surplus.calories - maintenance.calories).toBe(300);
  });

  it("treats strength the same as fitness — maintenance, no goal-based adjustment", () => {
    const fitness = computeNutritionTargets(profile({ goal: "fitness" }), "Male")!;
    const strength = computeNutritionTargets(profile({ goal: "strength" }), "Male")!;
    expect(strength.calories).toBe(fitness.calories);
  });

  it("clamps the calorie target to the 1200kcal safety floor for a light member on an aggressive deficit", () => {
    const p = profile({ weight_kg: 45, height_cm: 150, age: 60, sessions_per_week: 1, goal: "weight_loss" });
    const result = computeNutritionTargets(p, "Female")!;
    // Unclamped this profile computes to ~936kcal — well under the floor.
    expect(result.calories).toBe(1200);
  });

  it("never returns negative carbs even in a synthetic extreme where protein+fat would otherwise exceed the floor-clamped calorie target", () => {
    // Deliberately unrealistic inputs (age=1000) beyond what zod validation
    // would ever allow — this is testing the defensive Math.max(0, ...)
    // floor exists as a backstop, not a real member scenario, same
    // "belt and suspenders" style as generate-workout.ts's null-RPE guard.
    const p = profile({ weight_kg: 170, height_cm: 50, age: 1000, sessions_per_week: 1, goal: "weight_loss" });
    const result = computeNutritionTargets(p, "Female")!;
    expect(result.calories).toBe(1200);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBeGreaterThan(0);
  });
});
