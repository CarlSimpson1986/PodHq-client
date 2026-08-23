import { z } from "zod";
import { GOALS, EXPERIENCE_LEVELS, FOOD_PREFERENCES } from "@/lib/coach/types";

export const coachProfileSchema = z.object({
  goal: z.enum(GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  injuries: z.string().trim().max(500).optional().or(z.literal("")),
  sessionsPerWeek: z.number().int().min(1).max(6),
  weightKg: z.number().positive().max(400).optional(),
  heightCm: z.number().positive().max(250).optional(),
  age: z.number().int().min(13).max(100).optional(),
  mealCountPreference: z.number().int().min(1).max(8).optional(),
  foodAllergies: z.string().trim().max(500).optional().or(z.literal("")),
  foodPreferences: z.enum(FOOD_PREFERENCES).optional(),
});
