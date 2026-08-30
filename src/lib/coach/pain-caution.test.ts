import { describe, it, expect } from "vitest";
import { getPainCaution } from "./pain-caution";

describe("getPainCaution", () => {
  it("returns none when there's no check-in yet", () => {
    expect(getPainCaution(null, ["barbell_bench_press"])).toEqual({ kind: "none" });
  });

  it("returns none when the latest check-in reported no pain", () => {
    const result = getPainCaution({ hadPain: false, painDetail: null }, ["barbell_bench_press"]);
    expect(result).toEqual({ kind: "none" });
  });

  it("flags today's exercises that match the reported area", () => {
    const result = getPainCaution(
      { hadPain: true, painDetail: "shoulder, when pressing overhead" },
      ["dumbbell_shoulder_press", "barbell_squat"]
    );
    expect(result.kind).toBe("reported");
    if (result.kind === "reported") {
      expect(result.flaggedExerciseKeys).toContain("dumbbell_shoulder_press");
      expect(result.flaggedExerciseKeys).not.toContain("barbell_squat");
    }
  });

  it("still reports pain with no flagged exercises when the detail matches nothing in today's session", () => {
    const result = getPainCaution({ hadPain: true, painDetail: "shoulder" }, ["barbell_squat", "romanian_deadlift"]);
    expect(result).toEqual({ kind: "reported", painDetail: "shoulder", flaggedExerciseKeys: [] });
  });

  it("still reports pain with no flagged exercises when no detail was given at all", () => {
    const result = getPainCaution({ hadPain: true, painDetail: null }, ["barbell_squat"]);
    expect(result).toEqual({ kind: "reported", painDetail: null, flaggedExerciseKeys: [] });
  });
});
