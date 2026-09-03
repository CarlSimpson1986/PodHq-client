import { z } from "zod";
import { HABIT_TYPES } from "@/lib/coach/types";

// targetCount required for "counted", not accepted for "checkbox" — a
// member picking a recommended habit sends its default target, a custom
// counted habit needs one entered.
export const addHabitSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    habitType: z.enum(HABIT_TYPES),
    targetCount: z.number().int().min(1).max(999).optional(),
    unit: z.string().trim().max(20).optional(),
  })
  .refine((data) => data.habitType !== "counted" || data.targetCount !== undefined, {
    message: "targetCount is required when habitType is 'counted'.",
    path: ["targetCount"],
  });
