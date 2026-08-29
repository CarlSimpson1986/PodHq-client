import { describe, it, expect } from "vitest";
import {
  generateWorkout,
  getInjuryExcludedKeys,
  getEquipmentExcludedKeys,
  generateWorkoutTemplateSet,
  instantiateTemplate,
  pickFocusExercises,
  getStrengthFocusLabel,
} from "./generate-workout";
import type { CoachProfile } from "./coach-profile";
import { EXERCISE_CATALOG } from "./exercise-catalog";

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
    daily_activity_level: "moderately_active",
    meal_count_preference: null,
    food_allergies: null,
    food_preferences: null,
    nutrition_tracking_mode: "calorie_counting",
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

  // Changed 2026-08-27 — Carl: even a "conservative" experience-based
  // default is still the app guessing on a beginner's behalf. No weight
  // is suggested at all the first time; the member logs their own real
  // weight and RPE-based progression takes over from their second time
  // doing this exercise on.
  it("weight target is genuinely blank (null) the first time a member does an exercise, regardless of experience level", () => {
    const result = generateWorkout({ profile: profile({ experience_level: "beginner" }), history: [], lastSession: null });
    const exercise = result.find((e) => e.key === "barbell_bench_press")!;
    expect(exercise.weightTargetKg).toBeNull();
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
    // "knee, back, shoulders" excludes all but a few catalog entries —
    // safety (never surface an excluded exercise) wins over always filling
    // a full 4-exercise session. These have an empty avoidIfInjury list
    // (arm isolation exercises, plus dumbbell_calf_raise since the
    // 2026-08-29 Unbroken Fitness batch) — any of them is a valid safe
    // result.
    const result = generateWorkout({
      profile: profile({ injuries: "knee, back, shoulders" }),
      history: [],
      lastSession: null,
    });
    expect(result.length).toBeGreaterThan(0);
    const safeIsolationKeys = [
      "dumbbell_bicep_curl",
      "barbell_bicep_curl",
      "dumbbell_hammer_curl",
      "dumbbell_alternating_bicep_curl",
      "dumbbell_concentration_curl",
      "dumbbell_incline_hammer_curl",
      "dumbbell_spider_curl",
      "dumbbell_calf_raise",
    ];
    expect(result.every((e) => safeIsolationKeys.includes(e.key))).toBe(true);
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
    // Only dumbbell exercises and bodyweight (no equipment) can appear —
    // nothing needing a barbell rack, cable machine, or leg extension/curl
    // machine. Derived from the live catalog rather than a hand-typed list
    // — exerciseCount now varies with the session-length budget
    // (computeExerciseCount), so a fixed short list goes stale the moment
    // either the catalog grows or that budget changes; this checks the
    // actual invariant instead of a fixed slice of it.
    const allowedKeys = EXERCISE_CATALOG.filter((e) => e.requiredEquipment === null || e.requiredEquipment === "dumbbells").map((e) => e.key);
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
    // Safe under both filters combined: dumbbell/bodyweight equipment AND
    // no "shoulders" keyword in avoidIfInjury. Derived from the live
    // catalog rather than a hand-typed list, same reasoning as the
    // equipment-only test above.
    const safeKeys = EXERCISE_CATALOG.filter(
      (e) => (e.requiredEquipment === null || e.requiredEquipment === "dumbbells") && !e.avoidIfInjury.some((kw) => "shoulders".includes(kw))
    ).map((e) => e.key);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => safeKeys.includes(e.key))).toBe(true);
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

const BLOCK_START = "2026-01-05T00:00:00.000Z"; // a Monday

describe("generateWorkout — training blocks (Stage 12)", () => {
  it("uses the block's rep target instead of the goal's, when a block is active", () => {
    // profile() defaults to muscle_gain (goal reps target 10) — a strength
    // block's phase-1 target (6) must still win, proving the block
    // overrides goal.
    const result = generateWorkout({
      profile: profile({ goal: "muscle_gain" }),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "strength", startedAt: BLOCK_START },
      now: new Date(BLOCK_START),
    });
    expect(result[0].repsTarget).toBe(6);
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
      activeBlock: { blockType: "deload", startedAt: BLOCK_START },
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
      activeBlock: { blockType: "deload", startedAt: BLOCK_START },
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
      activeBlock: { blockType: "strength", startedAt: BLOCK_START },
    });
    const compoundKeys = ["barbell_squat", "romanian_deadlift", "barbell_bench_press", "lat_pulldown", "seated_row", "dumbbell_shoulder_press"];
    expect(result.every((e) => compoundKeys.includes(e.key))).toBe(true);
  });

  it("still never includes an unsafe exercise under a strength block, even though the compound pool is exhausted by injury filtering", () => {
    // Same "knee, back, shoulders" case as the goal-based test above — the
    // compound preference must fall back to the full safe isolation set
    // exactly like the muscle-group rotation already does, never
    // re-including something injury-excluded.
    const result = generateWorkout({
      profile: profile({ injuries: "knee, back, shoulders" }),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "strength", startedAt: BLOCK_START },
    });
    expect(result.length).toBeGreaterThan(0);
    const safeIsolationKeys = [
      "dumbbell_bicep_curl",
      "barbell_bicep_curl",
      "dumbbell_hammer_curl",
      "dumbbell_alternating_bicep_curl",
      "dumbbell_concentration_curl",
      "dumbbell_incline_hammer_curl",
      "dumbbell_spider_curl",
      "dumbbell_calf_raise",
    ];
    expect(result.every((e) => safeIsolationKeys.includes(e.key))).toBe(true);
  });
});

describe("generateWorkout — rep-range phases within a block (2026-08-25)", () => {
  // Stimulus-variety phasing, not fatigue-driven — Carl's call: general-
  // population 2-3x/week members benefit more from a fresh rep range
  // every 4 weeks than from copying a 3-week-push-then-deload cadence
  // built for far-higher-frequency athletes. See REP_TARGET_BY_BLOCK_PHASE.
  it("uses hypertrophy's phase 1 (weeks 1-4) target at block start", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "hypertrophy", startedAt: BLOCK_START },
      now: new Date(BLOCK_START),
    });
    expect(result[0].repsTarget).toBe(12);
  });

  it("uses hypertrophy's phase 2 (weeks 5-8) target 4 weeks in — a deliberately heavier/lower-rep middle phase, not the midpoint of phases 1 and 3", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "hypertrophy", startedAt: BLOCK_START },
      now: new Date("2026-02-02T00:00:00.000Z"), // BLOCK_START + 28 days
    });
    expect(result[0].repsTarget).toBe(6);
  });

  it("uses hypertrophy's phase 3 (weeks 9-12) target 8 weeks in", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "hypertrophy", startedAt: BLOCK_START },
      now: new Date("2026-03-02T00:00:00.000Z"), // BLOCK_START + 56 days
    });
    expect(result[0].repsTarget).toBe(15);
  });

  it("never drops a strength block's reps below 3, even well past the 12-week mark", () => {
    // No spotter in an unstaffed pod — true 1-3-rep max-effort work is a
    // real unsupervised-injury risk this app deliberately doesn't create.
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "strength", startedAt: BLOCK_START },
      now: new Date("2026-05-01T00:00:00.000Z"), // well past 12 weeks — a transition just not yet confirmed
    });
    expect(result[0].repsTarget).toBe(3);
  });

  it("deload's rep target stays flat regardless of block phase", () => {
    const result = generateWorkout({
      profile: profile(),
      history: [],
      lastSession: null,
      activeBlock: { blockType: "deload", startedAt: BLOCK_START },
      now: new Date("2026-03-02T00:00:00.000Z"),
    });
    expect(result[0].repsTarget).toBe(10);
  });
});

describe("generateWorkoutTemplateSet — persistent A/B/C rotation", () => {
  it("generates exactly 3 templates, letters A/B/C", () => {
    const result = generateWorkoutTemplateSet({ profile: profile() });
    expect(result.map((t) => t.letter)).toEqual(["A", "B", "C"]);
  });

  it("every template includes legs — the one group present in all three", () => {
    const result = generateWorkoutTemplateSet({ profile: profile() });
    for (const template of result) {
      expect(template.exercises.some((e) => e.muscleGroup === "legs")).toBe(true);
    }
  });

  it("prefers a different exercise per muscle group across templates where the catalog has more than one option", () => {
    const result = generateWorkoutTemplateSet({ profile: profile() });
    const chestPicks = result.flatMap((t) => t.exercises.filter((e) => e.muscleGroup === "chest").map((e) => e.key));
    // Chest has 3 catalog options after the 2026-08-27 expansion — A and C
    // both include a chest slot (see TEMPLATE_MUSCLE_GROUP_PLAN), and with
    // more than one candidate available they must pick different ones.
    expect(new Set(chestPicks).size).toBe(chestPicks.length);
  });

  it("respects injury exclusions the same way generateWorkout does", () => {
    const result = generateWorkoutTemplateSet({ profile: profile({ injuries: "shoulders" }) });
    const allKeys = result.flatMap((t) => t.exercises.map((e) => e.key));
    expect(allKeys).not.toContain("dumbbell_shoulder_press");
    expect(allKeys).not.toContain("incline_dumbbell_press");
    expect(allKeys).not.toContain("dumbbell_lateral_raise");
  });

  it("respects equipment exclusions the same way generateWorkout does", () => {
    const result = generateWorkoutTemplateSet({ profile: profile(), availableEquipment: ["dumbbells"] });
    // Every dumbbell-equipment catalog entry, plus plank (requiredEquipment
    // null — always available regardless of the equipment filter, same
    // hard-exclusion tier as avoidIfInjury). Kept as an explicit list
    // rather than deriving it from EXERCISE_CATALOG so this test actually
    // catches a real regression instead of trivially passing against
    // whatever the catalog happens to contain.
    const allowedKeys = [
      "dumbbell_shoulder_press",
      "dumbbell_bicep_curl",
      "incline_dumbbell_press",
      "dumbbell_lateral_raise",
      "dumbbell_russian_twist",
      "plank",
      "dumbbell_bench_press",
      "dumbbell_chest_fly",
      "dumbbell_single_arm_row",
      "dumbbell_pullover",
      "dumbbell_front_raise",
      "dumbbell_rear_delt_fly",
      "dumbbell_arnold_press",
      "dumbbell_hammer_curl",
      "dumbbell_overhead_tricep_extension",
      "dumbbell_side_bend",
      // 2026-08-29 — Unbroken Fitness Solutions batch, all dumbbells.
      "dumbbell_alternating_bench_press",
      "dumbbell_alternating_incline_press",
      "dumbbell_neutral_grip_press",
      "dumbbell_bench_supported_narrow_row",
      "dumbbell_bench_supported_wide_row",
      "dumbbell_prone_incline_row",
      "dumbbell_alternating_bicep_curl",
      "dumbbell_concentration_curl",
      "dumbbell_incline_hammer_curl",
      "dumbbell_spider_curl",
      "dumbbell_skull_crusher",
      "dumbbell_tricep_kickback",
      "dumbbell_front_squat",
      "dumbbell_goblet_squat",
      "dumbbell_suitcase_squat",
      "dumbbell_split_squat",
      "dumbbell_bulgarian_split_squat",
      "dumbbell_alternating_step_up",
      "dumbbell_lunge",
      "dumbbell_reverse_lunge",
      "dumbbell_deficit_reverse_lunge",
      "dumbbell_romanian_deadlift",
      "dumbbell_hip_thrust",
      "dumbbell_calf_raise",
    ];
    const allKeys = result.flatMap((t) => t.exercises.map((e) => e.key));
    expect(allKeys.every((key) => allowedKeys.includes(key))).toBe(true);
  });
});

describe("generateWorkoutTemplateSet — Strength squat/bench/deadlift split (2026-08-29)", () => {
  it("puts the named main lift first for each letter, not a muscle-group pick", () => {
    const result = generateWorkoutTemplateSet({ profile: profile({ goal: "strength" }), activeBlock: { blockType: "strength", startedAt: BLOCK_START } });
    const byLetter = Object.fromEntries(result.map((t) => [t.letter, t.exercises]));
    expect(byLetter.A[0]?.key).toBe("barbell_squat");
    expect(byLetter.B[0]?.key).toBe("barbell_bench_press");
    expect(byLetter.C[0]?.key).toBe("barbell_deadlift");
  });

  it("never returns a duplicate exercise within one letter, even though romanian_deadlift appears in two letters' lists", () => {
    const result = generateWorkoutTemplateSet({ profile: profile({ goal: "strength" }), activeBlock: { blockType: "strength", startedAt: BLOCK_START } });
    for (const template of result) {
      const keys = template.exercises.map((e) => e.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("skips an excluded main lift or accessory rather than substituting an unrelated exercise", () => {
    // "knees" excludes barbell_squat's avoidIfInjury-tagged variants — using
    // a made-up but realistic exclusion here via equipment instead, since
    // it's a cleaner way to force a specific known key out: no barbell rack
    // available removes barbell_squat itself from the safe pool entirely.
    const result = generateWorkoutTemplateSet({
      profile: profile({ goal: "strength" }),
      activeBlock: { blockType: "strength", startedAt: BLOCK_START },
      availableEquipment: ["dumbbells"],
    });
    const squatDay = result.find((t) => t.letter === "A")!;
    expect(squatDay.exercises.some((e) => e.key === "barbell_squat")).toBe(false);
    // Falls through to the next available key in A's list rather than
    // pulling in an unrelated leg exercise never named in the plan.
    expect(squatDay.exercises.some((e) => e.key === "dumbbell_bulgarian_split_squat")).toBe(true);
  });

  it("does not affect Hypertrophy/Deload blocks — same muscle-group rotation as before", () => {
    const result = generateWorkoutTemplateSet({ profile: profile(), activeBlock: { blockType: "hypertrophy", startedAt: BLOCK_START } });
    const allKeys = result.flatMap((t) => t.exercises.map((e) => e.key));
    expect(allKeys).not.toContain("barbell_deadlift");
  });
});

describe("getStrengthFocusLabel", () => {
  it("labels A/B/C as Squat/Bench/Deadlift Day for a strength block", () => {
    expect(getStrengthFocusLabel("A", "strength")).toBe("Squat Day");
    expect(getStrengthFocusLabel("B", "strength")).toBe("Bench Day");
    expect(getStrengthFocusLabel("C", "strength")).toBe("Deadlift Day");
  });

  it("returns null for any non-strength block, including undefined", () => {
    expect(getStrengthFocusLabel("A", "hypertrophy")).toBeNull();
    expect(getStrengthFocusLabel("A", "deload")).toBeNull();
    expect(getStrengthFocusLabel("A", undefined)).toBeNull();
  });
});

describe("instantiateTemplate — turns a fixed template into a live plan", () => {
  it("computes weight/reps fresh from current RPE history, not from anything stored on the template", () => {
    const template = [{ key: "barbell_bench_press", name: "Barbell Bench Press", muscleGroup: "chest" }];
    const result = instantiateTemplate(
      template,
      profile(),
      [{ exerciseKey: "barbell_bench_press", lastWeightKg: 40, lastRpe: 2 }],
      undefined,
      new Date("2026-01-15T00:00:00.000Z")
    );
    // Same 40 * 1.05 -> 42.5kg rounding as generateWorkout's own RPE test —
    // the template only fixed *which* exercise, weight is still live.
    expect(result[0].weightTargetKg).toBe(42.5);
  });

  it("skips a template exercise key no longer in the catalog rather than crashing", () => {
    const template = [
      { key: "not_a_real_exercise", name: "Ghost Exercise", muscleGroup: "chest" },
      { key: "plank", name: "Plank", muscleGroup: "core" },
    ];
    const result = instantiateTemplate(template, profile(), [], undefined);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("plank");
  });
});

describe("pickFocusExercises — Stage 3 focus-day selection", () => {
  it("only picks exercises from the chosen muscle group", () => {
    const result = pickFocusExercises(profile(), undefined, ["chest"]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.muscleGroup === "chest")).toBe(true);
  });

  it("caps at 6 exercises even with 2 well-stocked muscle groups", () => {
    const result = pickFocusExercises(profile(), undefined, ["chest", "back"]);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("round-robins across 2 chosen groups rather than exhausting the first before touching the second", () => {
    const result = pickFocusExercises(profile(), undefined, ["chest", "back"]);
    const chestCount = result.filter((e) => e.muscleGroup === "chest").length;
    const backCount = result.filter((e) => e.muscleGroup === "back").length;
    // Both well-stocked groups (chest and back each have several catalog
    // options) — round-robin should land close to evenly split, not
    // all-chest-then-back.
    expect(Math.abs(chestCount - backCount)).toBeLessThanOrEqual(1);
  });

  it("respects injury exclusions the same way generateWorkout does", () => {
    const result = pickFocusExercises(profile({ injuries: "shoulders" }), undefined, ["shoulders"]);
    expect(result.every((e) => e.key !== "dumbbell_shoulder_press" && e.key !== "cable_face_pull")).toBe(true);
  });

  it("respects equipment exclusions the same way generateWorkout does", () => {
    const result = pickFocusExercises(profile(), ["dumbbells"], ["chest"]);
    // Barbell/cable-only chest exercises must be excluded, leaving only
    // dumbbell + bodyweight options for chest.
    expect(result.every((e) => e.key !== "barbell_bench_press" && e.key !== "cable_chest_fly")).toBe(true);
  });

  it("returns an empty array when the chosen group has zero eligible exercises, rather than falling back to a different group", () => {
    // Every core catalog exercise's avoidIfInjury includes "back" — a
    // back-injury exclusion alone empties the core pool entirely,
    // regardless of equipment.
    const result = pickFocusExercises(profile({ injuries: "back" }), undefined, ["core"]);
    expect(result).toEqual([]);
  });
});
