import { describe, it, expect } from "vitest";
import { generateWorkout, getInjuryExcludedKeys, getEquipmentExcludedKeys } from "./generate-workout";
import type { CoachProfile } from "./coach-profile";

function profile(overrides: Partial<CoachProfile> = {}): CoachProfile {
  return {
    id: 1,
    member_id: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    goal: "muscle_gain",
    experience_level: "intermediate",
    injuries: null,
    sessions_per_week: 3,
    weight_kg: 75,
    height_cm: 178,
    age: 30,
    meal_count_preference: null,
    food_allergies: null,
    food_preferences: null,
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
      history: [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: 2 }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "barbell_bench_press")!;
    // 40 * 1.05 = 42, rounds up to the nearest 1.25kg plate increment.
    expect(exercise.weightTargetKg).toBe(42.5);
  });

  it("holds weight after a Just Right (RPE 3) set", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: 3 }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "barbell_bench_press")!;
    expect(exercise.weightTargetKg).toBe(40);
  });

  it("decreases weight after a Hard (RPE 4) set", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: 4 }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "barbell_bench_press")!;
    // 40 * 0.95 = 38, rounds down to the nearest 1.25kg plate increment.
    expect(exercise.weightTargetKg).toBe(37.5);
  });

  it("holds weight when the prior set was never rated", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: null }],
      lastSession: null,
    });
    const exercise = result.find((e) => e.key === "barbell_bench_press")!;
    expect(exercise.weightTargetKg).toBe(40);
  });

  it("falls back to the catalog's experience-based starting weight with no history", () => {
    const result = generateWorkout({ profile: profile({ experience_level: "beginner" }), history: [], lastSession: null });
    const exercise = result.find((e) => e.key === "barbell_bench_press")!;
    expect(exercise.weightTargetKg).toBe(20);
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
    expect(
      result.some((e) => e.key === "barbell_squat" || e.key === "leg_extension" || e.key === "lying_leg_curl")
    ).toBe(false);
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

describe("getInjuryExcludedKeys", () => {
  it("returns no excluded keys when there are no stated injuries", () => {
    expect(getInjuryExcludedKeys(null)).toEqual([]);
    expect(getInjuryExcludedKeys("")).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const excluded = getInjuryExcludedKeys("Bad Knee");
    expect(excluded).toContain("barbell_squat");
    expect(excluded).toContain("leg_extension");
    expect(excluded).not.toContain("barbell_bench_press");
  });
});

describe("generateWorkout — equipment awareness", () => {
  it("is unrestricted (today's exact behavior) with no availableEquipment given", () => {
    const result = generateWorkout({ profile: profile(), history: [], lastSession: null });
    expect(result.some((e) => e.key === "barbell_squat")).toBe(true);
  });

  it("excludes exercises whose required equipment isn't in the resource's configured list", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      availableEquipment: ["dumbbells"],
    });
    // Only dumbbell exercises and bodyweight (Plank, no equipment) can
    // appear — nothing needing a barbell rack, cable machine, or leg
    // extension/curl machine.
    const allowedKeys = ["dumbbell_shoulder_press", "dumbbell_bicep_curl", "plank"];
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => allowedKeys.includes(e.key))).toBe(true);
  });

  it("never re-includes an equipment-excluded exercise even when injury filtering also applies", () => {
    const result = generateWorkout({
      profile: profile({ injuries: "shoulders" }),
      history: [],
      lastSession: null,
      availableEquipment: ["dumbbells"],
    });
    // dumbbell_shoulder_press is excluded by the shoulder injury —
    // dumbbell_bicep_curl and plank are the only exercises left safe
    // under both filters combined.
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.key === "dumbbell_bicep_curl" || e.key === "plank")).toBe(true);
  });
});

describe("getEquipmentExcludedKeys", () => {
  it("returns no excluded keys when unrestricted (undefined or empty)", () => {
    expect(getEquipmentExcludedKeys(undefined)).toEqual([]);
    expect(getEquipmentExcludedKeys([])).toEqual([]);
  });

  it("excludes cable/rack/machine exercises when only dumbbells are available, but never bodyweight", () => {
    const excluded = getEquipmentExcludedKeys(["dumbbells"]);
    expect(excluded).toContain("barbell_squat");
    expect(excluded).toContain("lat_pulldown");
    expect(excluded).toContain("leg_extension");
    expect(excluded).not.toContain("dumbbell_bicep_curl");
    expect(excluded).not.toContain("plank");
  });
});

describe("generateWorkout — training blocks (Stage 12)", () => {
  it("uses the block's rep target instead of the goal's, when a block is active", () => {
    // profile() defaults to muscle_gain (goal reps target 10) — a strength
    // block (target 5) must still win, proving the block overrides goal.
    const result = generateWorkout({
      profile: profile({ goal: "muscle_gain" }),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "strength" },
    });
    expect(result[0].repsTarget).toBe(5);
  });

  it("falls back to the goal-based rep target with no active block — byte-identical to pre-Stage-12 behavior", () => {
    const result = generateWorkout({ profile: profile({ goal: "strength" }), history: [], lastSession: null });
    expect(result[0].repsTarget).toBe(5);
  });

  it("drops to 2 sets during a deload block instead of the usual 3", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "deload" },
    });
    expect(result[0].sets).toBe(2);
  });

  it("discounts weight by the deload multiplier, rounded to the nearest plate", () => {
    const withoutBlock = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: 3 }],
      lastSession: null,
    });
    const withDeload = generateWorkout({
      profile: profile(),
      history: [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: 3 }],
      lastSession: null,
      activeBlock: { blockType: "deload" },
    });
    const baseline = withoutBlock.find((e) => e.key === "barbell_bench_press")!.weightTargetKg;
    const deload = withDeload.find((e) => e.key === "barbell_bench_press")!.weightTargetKg;
    // 40 * 0.85 = 34, rounds down to the nearest 1.25kg plate increment.
    expect(baseline).toBe(40);
    expect(deload).toBe(33.75);
  });

  it("softly prefers compound lifts during a strength block", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "strength" },
    });
    const compoundKeys = ["barbell_squat", "romanian_deadlift", "barbell_bench_press", "lat_pulldown", "seated_row", "dumbbell_shoulder_press"];
    expect(result.every((e) => compoundKeys.includes(e.key))).toBe(true);
  });

  it("still never includes an unsafe exercise under a strength block, even though the compound pool is exhausted by injury filtering", () => {
    // Same "knee, back, shoulders" case as the goal-based test above — the
    // compound preference must fall back to the full safe set (just the
    // one isolation exercise left) exactly like the muscle-group rotation
    // already does, never re-including something injury-excluded.
    const result = generateWorkout({
      profile: profile({ injuries: "knee, back, shoulders" }),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "strength" },
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.key === "dumbbell_bicep_curl")).toBe(true);
  });
});
