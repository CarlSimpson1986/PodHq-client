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
    meal_count_preference: null,
    food_allergies: null,
    food_preferences: null,
    ...overrides,
  };
}

describe("computeNutritionTargets — Harris-Benedict + activity + goal", () => {
  it("computes calories/protein/fat/carbs for a typical male maintenance profile", () => {
    const result = computeNutritionTargets(profile(), "Male")!;
    expect(result.calories).toBe(2873);
    expect(result.proteinG).toBe(144);
    expect(result.fatG).toBe(88);
    expect(result.carbsG).toBe(377);
  });

  it("returns null when the profile is missing a required body stat", () => {
    expect(computeNutritionTargets(profile({ weight_kg: null }), "Male")).toBeNull();
    expect(computeNutritionTargets(profile({ height_cm: null }), "Male")).toBeNull();
    expect(computeNutritionTargets(profile({ age: null }), "Male")).toBeNull();
  });

  it("averages the male/female formula when gender is null, unset, or non-binary", () => {
    const p = profile({ weight_kg: 70, height_cm: 170, age: 25, sessions_per_week: 3 });
    const male = computeNutritionTargets(p, "Male")!;
    const female = computeNutritionTargets(p, "Female")!;
    const nullGender = computeNutritionTargets(p, null)!;
    const preferNotToSay = computeNutritionTargets(p, "Prefer not to say")!;
    expect(nullGender.calories).toBe(2490);
    expect(nullGender.calories).toBeGreaterThan(female.calories);
    expect(nullGender.calories).toBeLessThan(male.calories);
    expect(preferNotToSay.calories).toBe(nullGender.calories);
  });

  it("increases the activity multiplier as sessions_per_week rises across all three tiers", () => {
    const low = computeNutritionTargets(profile({ sessions_per_week: 1 }), "Male")!;
    const mid = computeNutritionTargets(profile({ sessions_per_week: 3 }), "Male")!;
    const high = computeNutritionTargets(profile({ sessions_per_week: 5 }), "Male")!;
    expect(low.calories).toBeLessThan(mid.calories);
    expect(mid.calories).toBeLessThan(high.calories);
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
    // Unclamped this profile computes to ~969kcal — well under the floor.
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
