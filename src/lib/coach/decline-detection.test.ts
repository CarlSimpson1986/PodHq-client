import { describe, it, expect } from "vitest";
import { estimateOneRepMax, detectDecline, findDeclineAlertExerciseKey } from "./decline-detection";
import type { ExerciseAppearance, ExerciseTrend } from "./coach-profile";

function appearance(overrides: Partial<ExerciseAppearance> = {}): ExerciseAppearance {
  return { sessionId: 1, weightActualKg: 60, repsActual: 8, rpe: 3, ...overrides };
}

function trend(exerciseKey: string, appearances: ExerciseAppearance[]): ExerciseTrend {
  return { exerciseKey, appearances };
}

describe("estimateOneRepMax", () => {
  it("applies the Epley formula", () => {
    // 100 * (1 + 5/30) = 116.67 -- spot-check against the known formula,
    // not just against detectDecline's own use of it.
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1);
  });
});

describe("detectDecline", () => {
  it("flags a genuine decline: falling e1RM across 3 appearances, RPE not eased off", () => {
    const t = trend("barbell_squat", [
      appearance({ weightActualKg: 55, repsActual: 8, rpe: 4 }), // newest, e1RM ~69.7
      appearance({ weightActualKg: 58, repsActual: 8, rpe: 4 }), // e1RM ~73.5
      appearance({ weightActualKg: 60, repsActual: 8, rpe: 3 }), // oldest, e1RM 76
    ]);
    expect(detectDecline(t)).toBe(true);
  });

  it("does not flag when the falling e1RM comes with RPE also easing off (deliberate back-off)", () => {
    const t = trend("barbell_squat", [
      appearance({ weightActualKg: 55, repsActual: 8, rpe: 2 }), // newest RPE eased off
      appearance({ weightActualKg: 58, repsActual: 8, rpe: 3 }),
      appearance({ weightActualKg: 60, repsActual: 8, rpe: 4 }), // oldest RPE was higher
    ]);
    expect(detectDecline(t)).toBe(false);
  });

  it("returns false with fewer than 3 real appearances", () => {
    const t = trend("barbell_squat", [appearance({ weightActualKg: 55 }), appearance({ weightActualKg: 60 })]);
    expect(detectDecline(t)).toBe(false);
  });

  it("resets the signal on an up-tick (newest e1RM higher than the middle appearance)", () => {
    const t = trend("barbell_squat", [
      appearance({ weightActualKg: 65, repsActual: 8 }), // newest jumps back up
      appearance({ weightActualKg: 58, repsActual: 8 }),
      appearance({ weightActualKg: 60, repsActual: 8 }),
    ]);
    expect(detectDecline(t)).toBe(false);
  });

  it("does not flag a lower weight when higher reps actually raise e1RM (rep-target phase change)", () => {
    const t = trend("barbell_squat", [
      appearance({ weightActualKg: 50, repsActual: 20 }), // newest: lower weight, e1RM ~83.3
      appearance({ weightActualKg: 60, repsActual: 8 }), // e1RM 76
      appearance({ weightActualKg: 60, repsActual: 8 }), // oldest: e1RM 76
    ]);
    expect(detectDecline(t)).toBe(false);
  });

  it("counts a flat tie between the two newest appearances as non-increasing", () => {
    const t = trend("barbell_squat", [
      appearance({ weightActualKg: 60, repsActual: 8, rpe: 3 }), // newest, e1RM 76 (tied with middle)
      appearance({ weightActualKg: 60, repsActual: 8, rpe: 3 }), // middle, e1RM 76
      appearance({ weightActualKg: 65, repsActual: 8, rpe: 3 }), // oldest, e1RM ~82.3 (the real decrease)
    ]);
    expect(detectDecline(t)).toBe(true);
  });

  it("still flags a decline when RPE is missing rather than treating it as eased-off", () => {
    const t = trend("barbell_squat", [
      appearance({ weightActualKg: 55, repsActual: 8, rpe: null }),
      appearance({ weightActualKg: 58, repsActual: 8, rpe: null }),
      appearance({ weightActualKg: 60, repsActual: 8, rpe: null }),
    ]);
    expect(detectDecline(t)).toBe(true);
  });
});

describe("findDeclineAlertExerciseKey", () => {
  const decliningTrend = (key: string) =>
    trend(key, [
      appearance({ weightActualKg: 55, repsActual: 8, rpe: 4 }),
      appearance({ weightActualKg: 58, repsActual: 8, rpe: 4 }),
      appearance({ weightActualKg: 60, repsActual: 8, rpe: 3 }),
    ]);

  it("never flags an accessory exercise, even a genuinely declining one", () => {
    const key = findDeclineAlertExerciseKey([{ key: "dumbbell_bicep_curl" }], [decliningTrend("dumbbell_bicep_curl")]);
    expect(key).toBeNull();
  });

  it("returns the first qualifying compound in plan order when more than one declines", () => {
    const key = findDeclineAlertExerciseKey(
      [{ key: "barbell_squat" }, { key: "barbell_bench_press" }],
      [decliningTrend("barbell_squat"), decliningTrend("barbell_bench_press")]
    );
    expect(key).toBe("barbell_squat");
  });

  it("returns null when a plan exercise has no trend data at all", () => {
    const key = findDeclineAlertExerciseKey([{ key: "barbell_squat" }], []);
    expect(key).toBeNull();
  });

  it("returns null when no compound exercise in the plan is declining", () => {
    // Newest-first: weight has been climbing session to session (60 -> 62
    // -> 64 as time passed), the normal progressing case.
    const key = findDeclineAlertExerciseKey(
      [{ key: "barbell_squat" }],
      [trend("barbell_squat", [appearance({ weightActualKg: 64 }), appearance({ weightActualKg: 62 }), appearance({ weightActualKg: 60 })])]
    );
    expect(key).toBeNull();
  });
});
