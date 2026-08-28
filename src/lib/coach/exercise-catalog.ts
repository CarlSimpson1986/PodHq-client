import type { EquipmentType } from "@/lib/coach/types";

export type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core" | "full_body";

export interface CatalogExercise {
  key: string;
  name: string;
  muscleGroup: MuscleGroup;
  // Keyword-matched (lowercase substring) against coach_profiles.injuries
  // free text — an exercise is excluded from generation if any of these
  // keywords appear in the member's stated injuries.
  avoidIfInjury: string[];
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
//
// No `startingWeightKg` field (removed 2026-08-27) — every exercise now
// starts with a genuinely blank weight the first time a member does it,
// rather than a per-experience-level default. Carl: even a "conservative"
// default is still the app guessing, and a beginner left to interpret a
// blank field on their own can misjudge what's actually light (e.g.
// "the bar plus 10kg", not realising an empty barbell is already
// ~20kg) — so it's not "blank vs. guessed," the member's own honestly-
// logged first weight becomes the real baseline for RPE-based
// progression from their second time on. See generate-workout.ts's
// computeWeightKg.
export const EXERCISE_CATALOG: CatalogExercise[] = [
  {
    key: "barbell_squat",
    name: "Barbell Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back"],
    safetyTip: "Keep your chest up and core braced. Push through your heels and don't let your knees cave inward.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee"],
    safetyTip: "Keep the bar close to your legs and your back flat. Hinge at the hips — don't round your lower back.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_bench_press",
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Feet flat on the floor, shoulder blades pulled back. Control the bar down — don't bounce it off your chest.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "lat_pulldown",
    name: "Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Pull with your back, not your arms. Avoid leaning back excessively or using momentum.",
    isCompound: true,
    requiredEquipment: "cable_machine",
  },
  {
    key: "seated_row",
    name: "Seated Row",
    muscleGroup: "back",
    avoidIfInjury: ["back"],
    safetyTip: "Keep your back straight and squeeze your shoulder blades together. Don't round forward at the start.",
    isCompound: true,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Brace your core and avoid arching your lower back. Press straight up, not forward.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_bicep_curl",
    name: "Dumbbell Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: [],
    safetyTip: "Keep your elbows close to your body and avoid swinging the weight. Control the lowering phase.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "tricep_pushdown",
    name: "Tricep Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Keep your elbows pinned to your sides. Avoid leaning your whole body into the movement.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "leg_extension",
    name: "Leg Extension",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    safetyTip: "Move through a controlled range — avoid snapping your knees straight at the top.",
    isCompound: false,
    requiredEquipment: "leg_extension_curl_machine",
  },
  {
    key: "lying_leg_curl",
    name: "Lying Leg Curl",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    safetyTip: "Keep your hips pressed into the pad. Avoid using momentum to swing the weight up.",
    isCompound: false,
    requiredEquipment: "leg_extension_curl_machine",
  },
  {
    key: "plank",
    name: "Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
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
    safetyTip: "Set the bench to a moderate incline (30-45°). Keep your wrists stacked over your elbows and lower the dumbbells under control.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "cable_chest_fly",
    name: "Cable Chest Fly",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Keep a slight bend in your elbows throughout. Bring your hands together in a wide arc — don't let the weight snap your arms back at the top of the stretch.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_lateral_raise",
    name: "Dumbbell Lateral Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Raise the dumbbells out to shoulder height with a slight bend in your elbows. Avoid swinging or using momentum — control the weight down.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "cable_face_pull",
    name: "Cable Face Pull",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Pull the rope towards your face, leading with your elbows high and wide. Squeeze your shoulder blades together at the end of the movement.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_crunch",
    name: "Cable Crunch",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Kneel facing the cable, hold the rope by your head, and curl your torso down using your abs — not your arms or hips.",
    isCompound: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_russian_twist",
    name: "Dumbbell Russian Twist",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Sit with your knees bent and lean back slightly, keeping your back straight. Rotate your torso side to side under control — don't just swing your arms.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_bent_over_row",
    name: "Barbell Bent-Over Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders"],
    safetyTip: "Hinge at the hips with a flat back, and pull the bar towards your lower ribs. Avoid rounding your back or using your legs to heave the weight up.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },

  // Added 2026-08-28: broader free-weight (barbell/dumbbell) coverage
  // across every muscle group, requested directly rather than tied to a
  // specific generation gap like the 08-27 batch above. Same conventions:
  // DRAFT, NOT YET CARL-REVIEWED safety tips in the established voice,
  // and requiredEquipment stays within Hove's existing dumbbells/
  // barbell_rack categories — no new EQUIPMENT_TYPES entry needed.
  {
    key: "barbell_deadlift",
    name: "Barbell Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee"],
    safetyTip: "Keep the bar close to your shins, chest up, and back flat throughout. Drive through your heels and stand tall — don't round your lower back to lift the weight.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_front_squat",
    name: "Barbell Front Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "shoulders"],
    safetyTip: "Keep your elbows high and chest up to support the bar across the front of your shoulders. Sit straight down between your hips — don't let your elbows drop or your torso fold forward.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_walking_lunge",
    name: "Barbell Walking Lunge",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back"],
    safetyTip: "Take controlled steps and keep your front knee tracking over your foot, not caving inward. Keep your torso upright — don't lean forward into the step.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_hip_thrust",
    name: "Barbell Hip Thrust",
    muscleGroup: "legs",
    avoidIfInjury: ["back"],
    safetyTip: "Rest the bar across your hips with a pad for comfort. Drive through your heels and squeeze your glutes at the top — don't overextend your lower back at full lockout.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_step_up",
    name: "Barbell Step-Up",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back"],
    safetyTip: "Step fully onto the platform with your whole foot before standing up. Control the descent — don't let your trailing leg slam down or push off it to help.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_bench_press",
    name: "Dumbbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Keep your feet flat on the floor and shoulder blades pulled back. Lower the dumbbells under control to chest level, then press up without locking out aggressively.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_chest_fly",
    name: "Dumbbell Flyes",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Keep a slight bend in your elbows throughout the movement. Lower the dumbbells out to the sides under control — don't let them drop past chest level.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_single_arm_row",
    name: "One-Arm Dumbbell Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders"],
    safetyTip: "Support yourself with one hand and knee on a bench, keeping your back flat. Pull the dumbbell towards your hip — don't twist your torso to help lift it.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_shrug",
    name: "Barbell Shrug",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Lift your shoulders straight up towards your ears, not rolling them forward or back. Keep your arms straight and avoid using momentum to jerk the weight up.",
    isCompound: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_pullover",
    name: "Dumbbell Pullover",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "back"],
    safetyTip: "Lie across a bench with your hips low and core braced. Lower the dumbbell back behind your head with a slight bend in your elbows — don't overextend beyond a comfortable stretch.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_overhead_press",
    name: "Barbell Overhead Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "back"],
    safetyTip: "Brace your core and keep the bar path close to your face as you press. Avoid arching your lower back to get the weight up — press with your shoulders, not your spine.",
    isCompound: true,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_front_raise",
    name: "Dumbbell Front Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Raise the dumbbells to shoulder height with a slight bend in your elbows. Avoid swinging your torso or using momentum — control the weight on the way down.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_rear_delt_fly",
    name: "Dumbbell Rear Delt Fly",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "back"],
    safetyTip: "Hinge forward from the hips with a flat back. Raise the dumbbells out to the sides squeezing your shoulder blades together, not up towards your ears.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_arnold_press",
    name: "Arnold Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Start with palms facing you and rotate outward as you press overhead. Keep the movement smooth and controlled — don't rush the rotation or arch your lower back.",
    isCompound: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_bicep_curl",
    name: "Barbell Curl",
    muscleGroup: "arms",
    avoidIfInjury: [],
    safetyTip: "Keep your elbows pinned to your sides and avoid swinging your body to lift the weight. Control the lowering phase all the way down.",
    isCompound: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_hammer_curl",
    name: "Hammer Curl",
    muscleGroup: "arms",
    avoidIfInjury: [],
    safetyTip: "Keep your palms facing each other throughout and your elbows close to your body. Avoid swinging the dumbbells — control both the lift and the lower.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_overhead_tricep_extension",
    name: "Standing Dumbbell Triceps Extension",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Keep your elbows pointing forward and close to your head. Lower the dumbbell behind your head under control — don't flare your elbows out to the sides.",
    isCompound: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_side_bend",
    name: "Dumbbell Side Bend",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Hold the dumbbell at your side and bend directly sideways, not forward or backward. Keep the movement slow and controlled — don't use momentum to swing back up.",
    isCompound: false,
    requiredEquipment: "dumbbells",
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
