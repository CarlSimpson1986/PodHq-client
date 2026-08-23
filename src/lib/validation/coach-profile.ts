import { z } from "zod";
import { GOALS, EXPERIENCE_LEVELS, FOOD_PREFERENCES } from "@/lib/coach/types";

// weightKg/heightCm/age are required, not optional — Harris-Benedict BMR
// (the formula the brief specifies for the not-yet-built nutrition
// feature) genuinely needs all three plus gender (already on `members`
// from the access flow). Letting a member skip these would mean asking
// again when nutrition ships, defeating the point of collecting
// everything in one onboarding pass. Body fat % isn't needed (that's only
// for Katch-McArdle, a different formula) and activity level isn't a
// separate field — the brief derives it from sessionsPerWeek, already
// required below.
export const coachProfileSchema = z.object({
  goal: z.enum(GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  injuries: z.string().trim().max(500).optional().or(z.literal("")),
  sessionsPerWeek: z.number().int().min(1).max(6),
  weightKg: z.number().positive().max(400),
  heightCm: z.number().positive().max(250),
  age: z.number().int().min(13).max(100),
  mealCountPreference: z.number().int().min(1).max(8).optional(),
  foodAllergies: z.string().trim().max(500).optional().or(z.literal("")),
  foodPreferences: z.enum(FOOD_PREFERENCES).optional(),
});
