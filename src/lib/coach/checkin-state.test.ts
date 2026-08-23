import { describe, it, expect } from "vitest";
import { getCheckInDueState, currentCheckInPeriod } from "./checkin-state";
import type { CoachProfile } from "./coach-profile";

// 2026-08-23 is a real Sunday (confirmed against this project's own
// playground-member seed data, which labels it "Sun" in the same weekday
// convention) — used throughout as the fixed weekly check-in day.
function profile(createdAt: string): CoachProfile {
  return {
    id: 1,
    member_id: 1,
    created_at: createdAt,
    goal: "fitness",
    experience_level: "intermediate",
    injuries: null,
    sessions_per_week: 3,
    weight_kg: 75,
    height_cm: 178,
    age: 30,
    meal_count_preference: null,
    food_allergies: null,
    food_preferences: null,
  };
}

describe("getCheckInDueState", () => {
  it("returns no_profile when there's no coach profile yet", () => {
    expect(getCheckInDueState(null, null, new Date("2026-08-26T12:00:00Z"))).toEqual({ kind: "no_profile" });
  });

  it("counts down to the next Sunday when the profile was created after this week's due day", () => {
    const p = profile("2026-08-26T09:00:00Z"); // Wednesday, this week
    const result = getCheckInDueState(p, null, new Date("2026-08-26T15:00:00Z"));
    expect(result).toEqual({ kind: "not_due", daysRemaining: 4, nextDueDate: "2026-08-30" });
  });

  it("is due exactly on the due day itself with no check-in yet", () => {
    const p = profile("2026-08-01T00:00:00Z");
    const result = getCheckInDueState(p, null, new Date("2026-08-23T09:00:00Z"));
    expect(result).toEqual({ kind: "due" });
  });

  it("stays due within the grace window (1-3 days after the due day)", () => {
    const p = profile("2026-08-01T00:00:00Z");
    const result = getCheckInDueState(p, null, new Date("2026-08-26T10:00:00Z")); // Wed, 3 days after Sunday
    expect(result).toEqual({ kind: "due" });
  });

  it("flips to overdue once the grace window has passed", () => {
    const p = profile("2026-08-01T00:00:00Z");
    const result = getCheckInDueState(p, null, new Date("2026-08-27T10:00:00Z")); // Thu, 4 days after Sunday
    expect(result).toEqual({ kind: "overdue", daysOverdue: 4 });
  });

  it("goes back to not_due once this period's check-in is completed", () => {
    const p = profile("2026-08-01T00:00:00Z");
    const lastCheckIn = { completedAt: "2026-08-23T18:00:00.000Z" };
    const result = getCheckInDueState(p, lastCheckIn, new Date("2026-08-26T15:00:00Z"));
    expect(result).toEqual({ kind: "not_due", daysRemaining: 4, nextDueDate: "2026-08-30" });
  });

  it("doesn't count a check-in completed for a previous period as covering the current one", () => {
    const p = profile("2026-08-01T00:00:00Z");
    const lastCheckIn = { completedAt: "2026-08-16T18:00:00.000Z" }; // the Sunday before last
    const result = getCheckInDueState(p, lastCheckIn, new Date("2026-08-27T10:00:00Z"));
    expect(result).toEqual({ kind: "overdue", daysOverdue: 4 });
  });
});

describe("currentCheckInPeriod", () => {
  it("returns the full Mon-Sun week ending on the most recent due day", () => {
    expect(currentCheckInPeriod(new Date("2026-08-26T15:00:00Z"))).toEqual({
      periodStart: "2026-08-17",
      periodEnd: "2026-08-23",
    });
  });
});
