import { z } from "zod";

export const generateWorkoutSchema = z.object({
  bookingId: z.number().int().positive(),
});

// rpe is optional — asked once per exercise, on its last set, not on
// every set (matches Zing's own placement of the RPE prompt, confirmed
// via the screenshot walkthrough this session).
export const logSetSchema = z.object({
  setId: z.number().int().positive(),
  repsActual: z.number().int().min(0).max(100),
  weightActualKg: z.number().min(0).max(500),
  rpe: z.number().int().min(1).max(5).optional(),
});

export const swapExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  newExerciseKey: z.string().min(1).max(100),
});
