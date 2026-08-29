import { z } from "zod";
import { MUSCLE_GROUPS } from "@/lib/coach/exercise-catalog";

// Stage 3 (2026-08-29) — mode defaults to "default" so the pre-existing
// caller shape (just a bookingId, no mode/picks) keeps working unchanged.
// focusMuscleGroups capped at 2 (freeform picker, Carl's call — no named
// splits), customExerciseKeys capped at 6 (same cap as the default
// generator's headroom, min 1 so a session is never empty) — both are
// only ever read by getOrCreateWorkoutSession when mode actually matches,
// and re-validated server-side regardless of what's sent here.
// customExerciseRests (2026-08-29, Stage 1 of the CrossFit-style
// custom-format work) — optional per-key rest-between-sets override,
// custom mode only. Capped at 10 minutes (600s); a key not present, or
// the field omitted entirely, means "use the app's default rest" (no
// rest-timer screen), same as before this existed.
export const generateWorkoutSchema = z
  .object({
    bookingId: z.number().int().positive(),
    mode: z.enum(["default", "focus", "custom"]).default("default"),
    focusMuscleGroups: z.array(z.enum(MUSCLE_GROUPS)).min(1).max(2).optional(),
    customExerciseKeys: z.array(z.string().min(1).max(100)).min(1).max(6).optional(),
    customExerciseRests: z.record(z.string().min(1).max(100), z.number().int().min(0).max(600)).optional(),
  })
  // A chosen mode must actually carry its own picks — without this, a
  // request could claim mode "focus" with no focusMuscleGroups and the
  // route would need to guess a fallback itself instead of the boundary
  // catching it.
  .refine((data) => data.mode !== "focus" || (data.focusMuscleGroups?.length ?? 0) > 0, {
    message: "focusMuscleGroups is required when mode is 'focus'.",
    path: ["focusMuscleGroups"],
  })
  .refine((data) => data.mode !== "custom" || (data.customExerciseKeys?.length ?? 0) > 0, {
    message: "customExerciseKeys is required when mode is 'custom'.",
    path: ["customExerciseKeys"],
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
