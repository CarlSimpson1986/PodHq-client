import type { ExperienceLevel } from "@/lib/coach/types";

export type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core" | "full_body";

export interface CatalogExercise {
  key: string;
  name: string;
  muscleGroup: MuscleGroup;
  // Keyword-matched (lowercase substring) against coach_profiles.injuries
  // free text — an exercise is excluded from generation if any of these
  // keywords appear in the member's stated injuries.
  avoidIfInjury: string[];
  // Conservative first-time weight, before any real RPE feedback exists
  // for this exercise. 0 = bodyweight/no added load.
  startingWeightKg: Record<ExperienceLevel, number>;
  // Reviewed, standard technique/safety cue — hardcoded and written by a
  // person, deliberately never LLM-generated. Same principle as the RPE
  // weight adjustment (generate-workout.ts): nothing with real injury
  // risk gets left to an LLM to improvise.
  safetyTip: string;
  // YouTube video ID (the 11-char id, not the full URL) for a real
  // technique demonstration — Carl-selected per exercise, not auto-picked
  // (form-check quality varies too much across YouTube to pick blind).
  // Undefined until chosen; workout-view.tsx falls back to the auto-loop
  // start/end photo pair when unset.
  youtubeVideoId?: string;
  // Squat/RDL/bench/lat pulldown/seated row/shoulder press vs. curl/
  // pushdown/leg extension/leg curl/plank — used to softly prefer
  // compound lifts during a Strength training block (see
  // generate-workout.ts's selectExercises).
  isCompound: boolean;
}

// Matches Hove's actual pod equipment (confirmed by Carl, 2026-08-23):
// dumbbells, a cable machine, a power rack with barbell and weights, and
// a leg extension/lying leg curl machine — plus bodyweight (plank, no
// equipment needed). Replaces the earlier generic placeholder list
// (which included a chest-press machine, kettlebell, and leg-press
// machine Hove doesn't actually have).
export const EXERCISE_CATALOG: CatalogExercise[] = [
  {
    key: "barbell_squat",
    name: "Barbell Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back"],
    // An empty Olympic bar is 20kg — the real floor for this exercise,
    // not 0.
    startingWeightKg: { beginner: 20, intermediate: 40, advanced: 60 },
    safetyTip: "Keep your chest up and core braced. Push through your heels and don't let your knees cave inward.",
    isCompound: true,
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee"],
    startingWeightKg: { beginner: 20, intermediate: 40, advanced: 60 },
    safetyTip: "Keep the bar close to your legs and your back flat. Hinge at the hips — don't round your lower back.",
    isCompound: true,
  },
  {
    key: "barbell_bench_press",
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 20, intermediate: 40, advanced: 60 },
    safetyTip: "Feet flat on the floor, shoulder blades pulled back. Control the bar down — don't bounce it off your chest.",
    isCompound: true,
  },
  {
    key: "lat_pulldown",
    name: "Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
    safetyTip: "Pull with your back, not your arms. Avoid leaning back excessively or using momentum.",
    isCompound: true,
  },
  {
    key: "seated_row",
    name: "Seated Row",
    muscleGroup: "back",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
    safetyTip: "Keep your back straight and squeeze your shoulder blades together. Don't round forward at the start.",
    isCompound: true,
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 6, intermediate: 10, advanced: 16 },
    safetyTip: "Brace your core and avoid arching your lower back. Press straight up, not forward.",
    isCompound: true,
  },
  {
    key: "dumbbell_bicep_curl",
    name: "Dumbbell Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: [],
    startingWeightKg: { beginner: 4, intermediate: 8, advanced: 12 },
    safetyTip: "Keep your elbows close to your body and avoid swinging the weight. Control the lowering phase.",
    isCompound: false,
  },
  {
    key: "tricep_pushdown",
    name: "Tricep Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 30 },
    safetyTip: "Keep your elbows pinned to your sides. Avoid leaning your whole body into the movement.",
    isCompound: false,
  },
  {
    key: "leg_extension",
    name: "Leg Extension",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 35 },
    safetyTip: "Move through a controlled range — avoid snapping your knees straight at the top.",
    isCompound: false,
  },
  {
    key: "lying_leg_curl",
    name: "Lying Leg Curl",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 35 },
    safetyTip: "Keep your hips pressed into the pad. Avoid using momentum to swing the weight up.",
    isCompound: false,
  },
  {
    key: "plank",
    name: "Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 0, intermediate: 0, advanced: 0 },
    safetyTip: "Keep your body in a straight line from head to heels — don't let your hips sag or pike up.",
    isCompound: false,
  },
];

// Start/end position photos, sourced from yuhonas/free-exercise-db
// (Unlicense, public domain) and self-hosted under public/exercises/ —
// see ROADMAP.md's Stage 5 entry for the id mapping used to download
// them. That dataset provides two static JPGs per exercise, not an
// animated GIF (the brief's "ExerciseDB GIFs" description doesn't match
// the real repo) — auto-looping between the two in the UI reads as
// motion without needing new assets.
export function getExerciseImages(key: string): [string, string] {
  return [`/exercises/${key}/0.jpg`, `/exercises/${key}/1.jpg`];
}

export function getSafetyTip(key: string): string | undefined {
  return EXERCISE_CATALOG.find((e) => e.key === key)?.safetyTip;
}

export function getYoutubeVideoId(key: string): string | undefined {
  return EXERCISE_CATALOG.find((e) => e.key === key)?.youtubeVideoId;
}
