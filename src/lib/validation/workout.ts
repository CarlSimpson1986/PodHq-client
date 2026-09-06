import { z } from "zod";
import { MUSCLE_GROUPS } from "@/lib/coach/exercise-catalog";
import { READINESS_LEVELS } from "@/lib/coach/types";

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
// amrapExercises (Stage 2, 2026-08-29) — each entry needs exactly one of
// reps/durationSeconds (checked in the cross-field refine below and
// re-checked in generateCircuitSession — never trust either boundary
// alone). weightKg optional, same 0-500 bound as logSetSchema's own
// weight field. timeCapSeconds 1-60 minutes — generous enough for any
// realistic AMRAP without allowing a nonsense multi-hour "time cap".
const amrapExerciseSchema = z.object({
  key: z.string().min(1).max(100),
  reps: z.number().int().min(1).max(100).optional(),
  durationSeconds: z.number().int().min(1).max(1800).optional(),
  weightKg: z.number().min(0).max(500).optional(),
});

export const generateWorkoutSchema = z
  .object({
    bookingId: z.number().int().positive(),
    mode: z.enum(["default", "focus", "custom", "custom-amrap", "custom-rft", "custom-hiit"]).default("default"),
    focusMuscleGroups: z.array(z.enum(MUSCLE_GROUPS)).min(1).max(2).optional(),
    customExerciseKeys: z.array(z.string().min(1).max(100)).min(1).max(6).optional(),
    customExerciseRests: z.record(z.string().min(1).max(100), z.number().int().min(0).max(600)).optional(),
    timeCapSeconds: z.number().int().min(60).max(3600).optional(),
    amrapExercises: z.array(amrapExerciseSchema).min(1).max(6).optional(),
    // targetRounds (Stage 3, 2026-08-30) — 1-20 rounds: 1 is a degenerate
    // but harmless single-circuit-for-time case, 20 is generous headroom
    // above any realistic RFT prescription (most real RFT workouts are
    // 3-5 rounds) without allowing a nonsense "200 rounds" entry.
    // Reuses amrapExercises as the exercise-list field for both circuit
    // formats — same shape, no separate rftExercises needed. HIIT (Stage
    // 4, 2026-08-30) reuses this same field for its own round count —
    // same "generic, reused across formats" convention as timeCapSeconds.
    targetRounds: z.number().int().min(1).max(20).optional(),
    // HIIT (Stage 4, 2026-08-30) — work/rest seconds are per-exercise
    // interval durations, set once for the whole session (uniform across
    // every exercise/round, no per-exercise override — Carl's own ask).
    // 5-300s covers everything from a Tabata-style 20s interval to a
    // generous 5-minute work block without allowing a nonsense value.
    // restBetweenRoundsSeconds allows 0 (no extra pause wanted between
    // rounds beyond the normal per-exercise rest). hiitExerciseKeys is
    // deliberately plain string[] (own field, not amrapExercises) — HIIT
    // has no per-exercise reps/duration/weight to carry.
    workSeconds: z.number().int().min(5).max(300).optional(),
    restSeconds: z.number().int().min(0).max(300).optional(),
    restBetweenRoundsSeconds: z.number().int().min(0).max(300).optional(),
    hiitExerciseKeys: z.array(z.string().min(1).max(100)).min(1).max(6).optional(),
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
  })
  // timeCapSeconds is required for BOTH circuit formats now (corrected
  // 2026-08-30 — real RFT WODs always carry a time cap, same as AMRAP).
  .refine((data) => !(data.mode === "custom-amrap" || data.mode === "custom-rft") || data.timeCapSeconds !== undefined, {
    message: "timeCapSeconds is required for this mode.",
    path: ["timeCapSeconds"],
  })
  .refine((data) => data.mode !== "custom-rft" || data.targetRounds !== undefined, {
    message: "targetRounds is required when mode is 'custom-rft'.",
    path: ["targetRounds"],
  })
  .refine((data) => !(data.mode === "custom-amrap" || data.mode === "custom-rft") || (data.amrapExercises?.length ?? 0) > 0, {
    message: "amrapExercises is required when mode is 'custom-amrap' or 'custom-rft'.",
    path: ["amrapExercises"],
  })
  .refine(
    (data) =>
      !(data.mode === "custom-amrap" || data.mode === "custom-rft") ||
      (data.amrapExercises ?? []).every((e) => (e.reps === undefined) !== (e.durationSeconds === undefined)),
    {
      message: "Each amrapExercises entry needs exactly one of reps or durationSeconds.",
      path: ["amrapExercises"],
    }
  )
  // RFT is reps-only (corrected 2026-08-30 — real RFT WODs prescribe reps
  // per round, never a timed hold; see generateCircuitSession's own
  // comment for why duration doesn't fit the "race the clock" mechanic).
  .refine((data) => data.mode !== "custom-rft" || (data.amrapExercises ?? []).every((e) => e.durationSeconds === undefined), {
    message: "Rounds For Time exercises must be reps-based, not duration-based.",
    path: ["amrapExercises"],
  })
  // HIIT (Stage 4, 2026-08-30) — all four fields required together; none
  // of AMRAP/RFT's reps-vs-duration checks apply since HIIT carries no
  // per-exercise prescription at all.
  .refine((data) => data.mode !== "custom-hiit" || data.workSeconds !== undefined, {
    message: "workSeconds is required when mode is 'custom-hiit'.",
    path: ["workSeconds"],
  })
  .refine((data) => data.mode !== "custom-hiit" || data.restSeconds !== undefined, {
    message: "restSeconds is required when mode is 'custom-hiit'.",
    path: ["restSeconds"],
  })
  .refine((data) => data.mode !== "custom-hiit" || data.targetRounds !== undefined, {
    message: "targetRounds is required when mode is 'custom-hiit'.",
    path: ["targetRounds"],
  })
  .refine((data) => data.mode !== "custom-hiit" || data.restBetweenRoundsSeconds !== undefined, {
    message: "restBetweenRoundsSeconds is required when mode is 'custom-hiit'.",
    path: ["restBetweenRoundsSeconds"],
  })
  .refine((data) => data.mode !== "custom-hiit" || (data.hiitExerciseKeys?.length ?? 0) > 0, {
    message: "hiitExerciseKeys is required when mode is 'custom-hiit'.",
    path: ["hiitExerciseKeys"],
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

export const avoidExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  reason: z.string().trim().max(200).optional(),
});

export const readinessCheckSchema = z.object({
  sleepQuality: z.enum(READINESS_LEVELS),
  soreness: z.enum(READINESS_LEVELS),
  energy: z.enum(READINESS_LEVELS),
});

// AMRAP completion tally (Stage 2, 2026-08-29) — self-reported, same
// trust posture as RPE/weight everywhere else in this app. Both partial
// fields are optional together: present means "then got partway through
// this exercise", absent means the member finished exactly on a round
// boundary. partialRoundExerciseIndex is the exercise's position in the
// round (0-based, matches workout_exercises.sort_order), not a raw id.
export const completeAmrapSchema = z
  .object({
    roundsCompleted: z.number().int().min(0).max(1000),
    partialRoundExerciseIndex: z.number().int().min(0).max(5).optional(),
    partialRoundReps: z.number().int().min(0).max(10000).optional(),
  })
  .refine((data) => (data.partialRoundExerciseIndex === undefined) === (data.partialRoundReps === undefined), {
    message: "partialRoundExerciseIndex and partialRoundReps must be provided together.",
    path: ["partialRoundReps"],
  });

// Rounds-For-Time completion (Stage 3, 2026-08-30; corrected same day —
// real RFT WODs have a time cap, so a member can fail to finish). Mirrors
// completeAmrapSchema's self-reported roundsCompleted/partial-round pair
// for the capped-out case; elapsedSeconds is the client's own stopwatch
// value (the real result when finished before the cap, or the cap itself
// when capped out — completeRoundsForTimeSession clamps either way).
export const completeRftSchema = z
  .object({
    elapsedSeconds: z.number().int().min(1).max(3600),
    roundsCompleted: z.number().int().min(0).max(20),
    partialRoundExerciseIndex: z.number().int().min(0).max(5).optional(),
    partialRoundReps: z.number().int().min(0).max(10000).optional(),
  })
  .refine((data) => (data.partialRoundExerciseIndex === undefined) === (data.partialRoundReps === undefined), {
    message: "partialRoundExerciseIndex and partialRoundReps must be provided together.",
    path: ["partialRoundReps"],
  });

// HIIT reps tally (2026-08-30) — optional per-exercise self-report, sent
// AFTER completeHiitSession has already run automatically (see
// completeHiitSession's own comment on why this is a separate step, not
// blocking). An empty array is valid — a member can skip logging
// entirely. Capped at 6 entries, matching every other exercise-list cap
// in this app (amrapExercises, customExerciseKeys).
export const logHiitRepsSchema = z.object({
  reps: z
    .array(
      z.object({
        exerciseId: z.number().int().positive(),
        reps: z.number().int().min(0).max(1000),
      })
    )
    .max(6),
});
