import { describe, it, expect } from "vitest";
import { displayNameFor, computeStreak } from "./leaderboard";

describe("displayNameFor", () => {
  it("formats a full name as first name + last initial", () => {
    expect(displayNameFor("Carl Simpson")).toBe("Carl S.");
  });

  it("uses the last word's initial when there are middle names", () => {
    expect(displayNameFor("Carl James Simpson")).toBe("Carl S.");
  });

  it("falls back to the bare name when there's only one word", () => {
    expect(displayNameFor("Carl")).toBe("Carl");
  });

  it("collapses extra whitespace", () => {
    expect(displayNameFor("  Carl   Simpson  ")).toBe("Carl S.");
  });
});

describe("computeStreak", () => {
  it("counts this week toward the streak once it's already hit target", () => {
    const counts = new Map([[0, 3]]);
    expect(computeStreak(counts, 3)).toBe(1);
  });

  it("doesn't break the streak just because this week isn't finished yet", () => {
    // This week (0) hasn't hit target, but weeks 1-2 did — the in-progress
    // week must not count as a miss, only genuinely elapsed weeks can.
    const counts = new Map([
      [0, 1],
      [1, 3],
      [2, 3],
    ]);
    expect(computeStreak(counts, 3)).toBe(2);
  });

  it("stops at the first fully-elapsed week that falls short", () => {
    const counts = new Map([
      [0, 3],
      [1, 3],
      [2, 1], // broke it here
      [3, 3],
    ]);
    expect(computeStreak(counts, 3)).toBe(2);
  });

  it("returns 0 when even this week and last week both miss", () => {
    const counts = new Map([
      [0, 0],
      [1, 0],
    ]);
    expect(computeStreak(counts, 2)).toBe(0);
  });

  it("treats a 2x/week goal and a 4x/week goal as equally 'perfect' streaks when each is met", () => {
    const twoPerWeek = new Map([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    const fourPerWeek = new Map([
      [0, 4],
      [1, 4],
      [2, 4],
    ]);
    expect(computeStreak(twoPerWeek, 2)).toBe(computeStreak(fourPerWeek, 4));
    expect(computeStreak(twoPerWeek, 2)).toBe(3);
  });
});
