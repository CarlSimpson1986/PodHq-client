import { describe, it, expect } from "vitest";
import { generateWorkout } from "./generate-workout";
import type { CoachProfile } from "./coach-profile";

function profile(overrides: Partial<CoachProfile> = {}): CoachProfile {
  return {
    id: 1,
    member_id: 1,
    goal: "muscle_gain",
    experience_level: "intermediate",
    injuries: null,
    sessions_per_week: 3,
    weight_kg: 75,
    height_cm: 178,
    age: 30,
    ...overrides,
  };
}

describe("generateWorkout — RPE-based weight progression", () => {
  // The rule added to MyFitPod-App-Brief.docx §9 this session: Effortless/
  // Easy trends the weight up, Just Right holds it, Hard/Killer holds or
  // trends it down.
  it("increases weight ~5% after an Easy (RPE 2) set, rounded to the nearest 1.25kg plate", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "seated_chest_press", lastWeightKg: 40, lastRpe: 2 }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "seated_chest_press")!;
    // 40 * 1.05 = 42, rounds up to the nearest 1.25kg plate increment.
    expect(exercise.weightTargetKg).toBe(42.5);
  });

  it("holds weight after a Just Right (RPE 3) set", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "seated_chest_press", lastWeightKg: 40, lastRpe: 3 }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "seated_chest_press")!;
    expect(exercise.weightTargetKg).toBe(40);
  });

  it("decreases weight after a Hard (RPE 4) set", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "seated_chest_press", lastWeightKg: 40, lastRpe: 4 }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "seated_chest_press")!;
    // 40 * 0.95 = 38, rounds down to the nearest 1.25kg plate increment.
    expect(exercise.weightTargetKg).toBe(37.5);
  });

  it("holds weight when the prior set was never rated", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "seated_chest_press", lastWeightKg: 40, lastRpe: null }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "seated_chest_press")!;
    expect(exercise.weightTargetKg).toBe(40);
  });

  it("falls back to the catalog's experience-based starting weight with no history", () => {
    const result = generateWorkout({ profile: profile({ experience_level: "beginner" }), history: [], lastSession: null });
    const exercise = result.find((e) => e.key === "seated_chest_press")!;
    expect(exercise.weightTargetKg).toBe(15);
  });
});

describe("generateWorkout — rep targets by goal", () => {
  it("uses a lower rep range for strength than for muscle_gain or fitness", () => {
    const strength = generateWorkout({ profile: profile({ goal: "strength" }), history: [], lastSession: null });
    const fitness = generateWorkout({ profile: profile({ goal: "fitness" }), history: [], lastSession: null });
    expect(strength[0].repsTarget).toBeLessThan(fitness[0].repsTarget);
  });
});

describe("generateWorkout — muscle-group rotation", () => {
  it("avoids muscle groups trained in the immediately preceding session when enough exercises remain", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: { muscleGroups: ["chest", "back"] },
    });
    expect(result.every((e) => e.muscleGroup !== "chest" && e.muscleGroup !== "back")).toBe(true);
  });
});

describe("generateWorkout — injury avoidance", () => {
  it("excludes exercises tagged against a stated injury, case-insensitively", () => {
    const result = generateWorkout({ profile: profile({ injuries: "Bad Knee" }), history: [], lastSession: null });
    expect(result.some((e) => e.key === "goblet_squat" || e.key === "bodyweight_squat" || e.key === "leg_press")).toBe(false);
  });

  it("never includes an unsafe exercise, even when heavy injury filtering leaves very few options", () => {
    // "knee, back, shoulders" excludes all but one catalog entry — safety
    // (never surface an excluded exercise) wins over always filling a
    // full 4-exercise session.
    const result = generateWorkout({
      profile: profile({ injuries: "knee, back, shoulders" }),
      history: [],
      lastSession: null,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.key === "dumbbell_bicep_curl")).toBe(true);
  });
});
