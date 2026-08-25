import { describe, it, expect } from "vitest";
import { gramsToPortions } from "./portions";

describe("gramsToPortions", () => {
  it("converts whole-number grams to whole portions", () => {
    // 25g/palm, 50g/cupped-hand, 15g/thumb — see types.ts.
    expect(gramsToPortions(50, 100, 30)).toEqual({ palms: 2, cuppedHands: 2, thumbs: 2 });
  });

  it("rounds to the nearest half portion", () => {
    expect(gramsToPortions(30, 60, 18)).toEqual({ palms: 1, cuppedHands: 1, thumbs: 1 });
    expect(gramsToPortions(37, 75, 22)).toEqual({ palms: 1.5, cuppedHands: 1.5, thumbs: 1.5 });
  });

  it("returns zero portions for zero grams", () => {
    expect(gramsToPortions(0, 0, 0)).toEqual({ palms: 0, cuppedHands: 0, thumbs: 0 });
  });
});
