import type { EquipmentType, ExperienceLevel } from "@/lib/coach/types";

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
  // Which pod_resources.equipment category this exercise needs — null
  // for bodyweight-only movements (always available regardless of a
  // resource's configured equipment). A hard exclusion in
  // generate-workout.ts's selectExercises, same tier as avoidIfInjury.
  requiredEquipment: EquipmentType | null;
}

// Every resistance exercise this app can generate, across every gym —
// each one's requiredEquipment says what pod_resources.equipment a gym
// needs for it to actually be offered there (see generate-workout.ts's
// selectExercises and workout-session.ts's getOrCreateWorkoutSession).
// The catalog itself isn't gym-specific; only which subset a given pod
// draws from is. Originally written to match Hove's actual pod equipment
// (confirmed by Carl, 2026-08-23) — dumbbells, a cable machine, a power
// rack with barbell and weights, a leg extension/lying leg curl machine,
// plus bodyweight (plank, no equipment needed) — which is why that's
// still every category this catalog covers; a future gym with equipment
// outside these four categories needs both a new exercise here and a new
// EQUIPMENT_TYPES entry (coach/types.ts) before it can be offered. There's
// also a Peloton treadmill/bike at Hove (confirmed same day) — not
// represented here since it's cardio, not a resistance exercise this
// catalog generates working sets for, but it's what the warm-up's pulse
// raiser uses (see warmup-cooldown.ts).
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
    requiredEquipment: "barbell_rack",
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee"],
    startingWeightKg: { beginner: 20, intermediate: 40, advanced: 60 },
    safetyTip: "Keep the bar close to your legs and your back flat. Hinge at the hips — don't round your lower back.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_bench_press",
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 20, intermediate: 40, advanced: 60 },
    safetyTip: "Feet flat on the floor, shoulder blades pulled back. Control the bar down — don't bounce it off your chest.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "lat_pulldown",
    name: "Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
    safetyTip: "Pull with your back, not your arms. Avoid leaning back excessively or using momentum.",
    isCompound: true,
    requiredEquipment: "cable_machine",
  },
  {
    key: "seated_row",
    name: "Seated Row",
    muscleGroup: "back",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
    safetyTip: "Keep your back straight and squeeze your shoulder blades together. Don't round forward at the start.",
    isCompound: true,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 6, intermediate: 10, advanced: 16 },
    safetyTip: "Brace your core and avoid arching your lower back. Press straight up, not forward.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_bicep_curl",
    name: "Dumbbell Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: [],
    startingWeightKg: { beginner: 4, intermediate: 8, advanced: 12 },
    safetyTip: "Keep your elbows close to your body and avoid swinging the weight. Control the lowering phase.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "tricep_pushdown",
    name: "Tricep Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 30 },
    safetyTip: "Keep your elbows pinned to your sides. Avoid leaning your whole body into the movement.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "leg_extension",
    name: "Leg Extension",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 35 },
    safetyTip: "Move through a controlled range — avoid snapping your knees straight at the top.",
    isCompound: false,
    requiredEquipment: "leg_extension_curl_machine",
  },
  {
    key: "lying_leg_curl",
    name: "Lying Leg Curl",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 35 },
    safetyTip: "Keep your hips pressed into the pad. Avoid using momentum to swing the weight up.",
    isCompound: false,
    requiredEquipment: "leg_extension_curl_machine",
  },
  {
    key: "plank",
    name: "Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 0, intermediate: 0, advanced: 0 },
    safetyTip: "Keep your body in a straight line from head to heels — don't let your hips sag or pike up.",
    isCompound: false,
    requiredEquipment: null,
  },

  // Added 2026-08-27 for the A/B/C workout-template rotation (see
  // generate-workout.ts's generateWorkoutTemplateSet) — chest, shoulders
  // and core previously had exactly one catalog exercise each, which
  // would have forced every template to repeat the identical exercise
  // for those groups. All still within Hove's existing 4 equipment
  // categories, no new EQUIPMENT_TYPES entry needed.
  //
  // DRAFT SAFETY TIPS — every safetyTip on this app is otherwise
  // written by a person, deliberately never LLM-generated (see this
  // file's own top comment and the RPE-adjustment reasoning in
  // generate-workout.ts). These 7 are a starting draft in the same
  // voice as the existing ones, not yet Carl-reviewed — treat as
  // placeholder text, same as this app's other "starts as placeholder"
  // content, until he's checked/edited them.
  {
    key: "incline_dumbbell_press",
    name: "Incline Dumbbell Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 6, intermediate: 10, advanced: 16 },
    safetyTip: "Set the bench to a moderate incline (30-45°). Keep your wrists stacked over your elbows and lower the dumbbells under control.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "cable_chest_fly",
    name: "Cable Chest Fly",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 5, intermediate: 10, advanced: 15 },
    safetyTip: "Keep a slight bend in your elbows throughout. Bring your hands together in a wide arc — don't let the weight snap your arms back at the top of the stretch.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_lateral_raise",
    name: "Dumbbell Lateral Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 2, intermediate: 4, advanced: 6 },
    safetyTip: "Raise the dumbbells out to shoulder height with a slight bend in your elbows. Avoid swinging or using momentum — control the weight down.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "cable_face_pull",
    name: "Cable Face Pull",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 5, intermediate: 10, advanced: 15 },
    safetyTip: "Pull the rope towards your face, leading with your elbows high and wide. Squeeze your shoulder blades together at the end of the movement.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_crunch",
    name: "Cable Crunch",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 30 },
    safetyTip: "Kneel facing the cable, hold the rope by your head, and curl your torso down using your abs — not your arms or hips.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_russian_twist",
    name: "Dumbbell Russian Twist",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 4, intermediate: 8, advanced: 12 },
    safetyTip: "Sit with your knees bent and lean back slightly, keeping your back straight. Rotate your torso side to side under control — don't just swing your arms.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_bent_over_row",
    name: "Barbell Bent-Over Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders"],
    startingWeightKg: { beginner: 20, intermediate: 40, advanced: 60 },
    safetyTip: "Hinge at the hips with a flat back, and pull the bar towards your lower ribs. Avoid rounding your back or using your legs to heave the weight up.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
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
