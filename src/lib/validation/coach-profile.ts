import { z } from "zod";
import { GOALS, EXPERIENCE_LEVELS, FOOD_PREFERENCES, NUTRITION_TRACKING_MODES, DAILY_ACTIVITY_LEVELS } from "@/lib/coach/types";

// weightKg/heightCm/age are required, not optional — Mifflin-St Jeor BMR
// genuinely needs all three plus gender (already on `members` from the
// access flow). Letting a member skip these would mean asking again when
// nutrition ships, defeating the point of collecting everything in one
// onboarding pass. Body fat % isn't needed (that's only for Katch-McArdle,
// a different formula). dailyActivityLevel is required too (2026-08-29) —
// occupational activity, a separate axis from sessionsPerWeek (that's for
// training-block programming, not TDEE — Carl's own call).
export const coachProfileSchema = z.object({
  goal: z.enum(GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  injuries: z.string().trim().max(500).optional().or(z.literal("")),
  sessionsPerWeek: z.number().int().min(1).max(6),
  weightKg: z.number().positive().max(400),
  heightCm: z.number().positive().max(250),
  age: z.number().int().min(13).max(100),
  dailyActivityLevel: z.enum(DAILY_ACTIVITY_LEVELS),
  mealCountPreference: z.number().int().min(1).max(8).optional(),
  foodAllergies: z.string().trim().max(500).optional().or(z.literal("")),
  foodPreferences: z.enum(FOOD_PREFERENCES).optional(),
  nutritionTrackingMode: z.enum(NUTRITION_TRACKING_MODES).optional(),
});
