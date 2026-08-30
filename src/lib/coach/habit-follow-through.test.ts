import { describe, it, expect } from "vitest";
import { computeHabitFollowThrough } from "./habit-follow-through";

describe("computeHabitFollowThrough", () => {
  it("returns null when there's no check-in with an answer yet", () => {
    expect(computeHabitFollowThrough([])).toBeNull();
    expect(computeHabitFollowThrough([{ habitFollowUp: null }])).toBeNull();
  });

  it("counts yes as progress", () => {
    expect(computeHabitFollowThrough([{ habitFollowUp: "yes" }])).toEqual({ madeProgress: 1, total: 1 });
  });

  it("counts partially as progress too, not a miss", () => {
    expect(computeHabitFollowThrough([{ habitFollowUp: "partially" }])).toEqual({ madeProgress: 1, total: 1 });
  });

  it("counts no as the only genuine miss", () => {
    expect(computeHabitFollowThrough([{ habitFollowUp: "no" }])).toEqual({ madeProgress: 0, total: 1 });
  });

  it("skips check-ins with no answer rather than counting them as a miss", () => {
    const result = computeHabitFollowThrough([{ habitFollowUp: "yes" }, { habitFollowUp: null }, { habitFollowUp: "no" }]);
    expect(result).toEqual({ madeProgress: 1, total: 2 });
  });

  it("only looks at the trailing 8 answered check-ins", () => {
    const nineYes = Array.from({ length: 9 }, () => ({ habitFollowUp: "yes" as const }));
    const result = computeHabitFollowThrough([...nineYes, { habitFollowUp: "no" }]);
    expect(result).toEqual({ madeProgress: 8, total: 8 });
  });
});
