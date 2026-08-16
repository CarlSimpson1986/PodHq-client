import { describe, it, expect } from "vitest";
import { isWithinBookableHours } from "./bookable-hours";

describe("isWithinBookableHours", () => {
  // Regression test for the bug found 2026-08-11: Vercel's serverless
  // functions run in UTC internally regardless of region, so a plain
  // `.getHours()` on the server would read 08:00 for this slot instead of
  // the correct UK wall-clock hour of 09:00 during BST — silently letting
  // an 08:00-configured gym reject a legitimately-in-hours 09:00 booking,
  // or the reverse. 2026-07-15 12:00 UTC is 13:00 BST.
  it("reads the UK wall-clock hour during BST, not the UTC hour", () => {
    const bstSlot = "2026-07-15T08:00:00.000Z"; // 09:00 in Europe/London during BST
    expect(isWithinBookableHours(bstSlot, 9, 17)).toBe(true);
    expect(isWithinBookableHours(bstSlot, 10, 17)).toBe(false);
  });

  it("matches UTC directly outside BST (no offset)", () => {
    const winterSlot = "2026-01-15T09:00:00.000Z"; // 09:00 in Europe/London, GMT
    expect(isWithinBookableHours(winterSlot, 9, 17)).toBe(true);
    expect(isWithinBookableHours(winterSlot, 10, 17)).toBe(false);
  });

  it("excludes the closing hour itself (half-open range)", () => {
    const slot = "2026-01-15T17:00:00.000Z"; // exactly closeHour
    expect(isWithinBookableHours(slot, 9, 17)).toBe(false);
  });

  it("includes the opening hour itself", () => {
    const slot = "2026-01-15T09:00:00.000Z"; // exactly openHour
    expect(isWithinBookableHours(slot, 9, 17)).toBe(true);
  });

  it("treats 0/24 as fully open, all day", () => {
    expect(isWithinBookableHours("2026-01-15T00:00:00.000Z", 0, 24)).toBe(true);
    expect(isWithinBookableHours("2026-01-15T23:00:00.000Z", 0, 24)).toBe(true);
  });
});
