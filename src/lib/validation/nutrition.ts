import { z } from "zod";
import { MEALS, FOOD_LOG_SOURCES } from "@/lib/coach/types";

export const logFoodSchema = z.object({
  meal: z.enum(MEALS),
  foodName: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(100).optional().or(z.literal("")),
  quantityG: z.number().positive().max(5000),
  caloriesPer100g: z.number().min(0).max(2000),
  proteinPer100g: z.number().min(0).max(200),
  carbsPer100g: z.number().min(0).max(200),
  fatPer100g: z.number().min(0).max(200),
  source: z.enum(FOOD_LOG_SOURCES),
  // "YYYY-MM-DD" — optional, defaults to today (Europe/London) server-side.
  loggedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const foodSearchQuerySchema = z.object({
  q: z.string().trim().min(3).max(100),
});

export const dayLogQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
