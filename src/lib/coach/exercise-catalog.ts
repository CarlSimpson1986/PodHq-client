import type { EquipmentType } from "@/lib/coach/types";

export type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core" | "full_body";

// The 6 groups a catalog exercise can actually be tagged with — "full_body"
// is a union member no exercise below uses, so it's excluded here rather
// than offered as a selectable focus-day group that would always resolve
// to an empty pool. Used for Stage 3's focus-day muscle-group picker
// (generate-workout.ts's pickFocusExercises) and its zod validation
// (validation/workout.ts).
export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "legs", "arms", "core"] as const;

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
  // Optional playback window (whole seconds) passed to the YouTube embed's
  // own start/end params — trims the clip without touching the source
  // video at all (still YouTube's real player/file, just a bounded
  // playback range, not a download+re-edit — the real copyright/DMCA-CMI
  // risk Carl and I discussed for the alternative of stripping a
  // creator's watermark ourselves). Added 2026-08-29 for the Unbroken
  // Fitness Solutions batches below. Originally set per-video to (real
  // duration - 5) to land just before each clip's brand watermark, but
  // Carl's later call (same day) was simpler: every clip plays 0-10
  // seconds flat, full stop — long enough to see the setup and first rep,
  // short enough that the watermark (wherever it falls) never plays
  // regardless of a given clip's real length.
  youtubeStartSeconds?: number;
  youtubeEndSeconds?: number;
  // Squat/RDL/bench/lat pulldown/seated row/shoulder press vs. curl/
  // pushdown/leg extension/leg curl/plank — used to softly prefer
  // compound lifts during a Strength training block (see
  // generate-workout.ts's selectExercises).
  isCompound: boolean;
  // True for real HIIT/CrossFit-style conditioning movements — researched
  // against actual published HIIT/CrossFit programming (2026-08-29, not
  // guessed), then cross-checked against what this app's pods actually
  // have (bodyweight + kettlebells + dumbbells; no rower, bike, pull-up
  // bar, plyo box, or wall-ball target). Drives the "Build your own"
  // builder's Weights/Cardio split (workout-view.tsx) — Cardio only ever
  // offers exercises with this flag true, Weights only ever offers the
  // rest. A given exercise is one or the other, never both.
  isConditioning: boolean;
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
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Keep your chest up and core braced. Push through your heels and don't let your knees cave inward.",
    youtubeVideoId: "CM4V8uX0bnk",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee", "hamstring"],
    safetyTip: "Keep the bar close to your legs and your back flat. Hinge at the hips — don't round your lower back.",
    youtubeVideoId: "wkAahHGkpXA",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_bench_press",
    name: "Barbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Feet flat on the floor, shoulder blades pulled back. Control the bar down — don't bounce it off your chest.",
    youtubeVideoId: "wpMyPMjGHvI",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "lat_pulldown",
    name: "Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Pull with your back, not your arms. Avoid leaning back excessively or using momentum.",
    youtubeVideoId: "6zhBExMcpyc",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    // DRAFT safetyTip — Carl to review/rewrite before this goes live, per
    // this file's own convention that safety cues are human-written, not
    // LLM-generated. Added 2026-09-06 alongside lat_pulldown_double_handle
    // for Carl's own technique-video shoot — same movement as lat_pulldown,
    // different attachment.
    // isCompound: false (not true, unlike lat_pulldown itself) — this is
    // the same movement pattern with a different grip attachment, not a
    // distinct compound pattern of its own. selectExercises's Strength-
    // block preference does a flat array-order slice over every
    // isCompound exercise, not a one-per-muscle-group pick, so marking a
    // same-pattern grip variant compound too would let it crowd out a
    // genuinely different pattern (found via generate-workout.test.ts's
    // "softly prefers compound lifts" test going from 6 distinct patterns
    // to 3 lat-pulldown variants when this was true).
    key: "lat_pulldown_v_grip",
    name: "V-Grip Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Pull the handles down to your upper chest, keeping elbows close to your body. Pull with your back, not your arms — avoid leaning back excessively or using momentum.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    // DRAFT safetyTip — see lat_pulldown_v_grip above.
    // isCompound: false — see lat_pulldown_v_grip's comment above, same
    // reasoning.
    key: "lat_pulldown_double_handle",
    name: "Double-Handle Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Pull both handles down and out to the sides, driving your elbows down and back. Pull with your back, not your arms — avoid leaning back excessively or using momentum.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "seated_row",
    name: "Seated Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "elbow"],
    safetyTip: "Keep your back straight and squeeze your shoulder blades together. Don't round forward at the start.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "elbow", "neck"],
    safetyTip: "Brace your core and avoid arching your lower back. Press straight up, not forward.",
    youtubeVideoId: "gDZAbauWnbk",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_bicep_curl",
    name: "Dumbbell Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Keep your elbows close to your body and avoid swinging the weight. Control the lowering phase.",
    youtubeVideoId: "Ejp6Y6v7b9k",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "tricep_pushdown",
    name: "Tricep Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your elbows pinned to your sides. Avoid leaning your whole body into the movement.",
    youtubeVideoId: "XSFhpU04AMg",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "leg_extension",
    name: "Leg Extension",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "quad"],
    safetyTip: "Move through a controlled range — avoid snapping your knees straight at the top.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "leg_extension_curl_machine",
  },
  {
    key: "lying_leg_curl",
    name: "Lying Leg Curl",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "hamstring"],
    safetyTip: "Keep your hips pressed into the pad. Avoid using momentum to swing the weight up.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "leg_extension_curl_machine",
  },
  {
    key: "plank",
    name: "Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back", "wrist"],
    safetyTip: "Keep your body in a straight line from head to heels — don't let your hips sag or pike up.",
    isCompound: false,
    isConditioning: false,
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
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Set the bench to a moderate incline (30-45°). Keep your wrists stacked over your elbows and lower the dumbbells under control.",
    youtubeVideoId: "vnX5WfQE3b0",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "cable_chest_fly",
    name: "Cable Chest Fly",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep a slight bend in your elbows throughout. Bring your hands together in a wide arc — don't let the weight snap your arms back at the top of the stretch.",
    youtubeVideoId: "jpQK7coF8BE",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_lateral_raise",
    name: "Dumbbell Lateral Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Raise the dumbbells out to shoulder height with a slight bend in your elbows. Avoid swinging or using momentum — control the weight down.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "cable_face_pull",
    name: "Cable Face Pull",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "neck"],
    safetyTip: "Pull the rope towards your face, leading with your elbows high and wide. Squeeze your shoulder blades together at the end of the movement.",
    youtubeVideoId: "n6M82WrD3dA",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_crunch",
    name: "Cable Crunch",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Kneel facing the cable, hold the rope by your head, and curl your torso down using your abs — not your arms or hips.",
    youtubeVideoId: "2AZyh9BDOjk",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_russian_twist",
    name: "Dumbbell Russian Twist",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Sit with your knees bent and lean back slightly, keeping your back straight. Rotate your torso side to side under control — don't just swing your arms.",
    isCompound: false,
    isConditioning: true,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_bent_over_row",
    name: "Barbell Bent-Over Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Hinge at the hips with a flat back, and pull the bar towards your lower ribs. Avoid rounding your back or using your legs to heave the weight up.",
    youtubeVideoId: "KUlUyT3uE0M",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
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
    avoidIfInjury: ["back", "knee", "hamstring"],
    safetyTip: "Keep the bar close to your shins, chest up, and back flat throughout. Drive through your heels and stand tall — don't round your lower back to lift the weight.",
    youtubeVideoId: "NSPjk6AyMPo",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_front_squat",
    name: "Barbell Front Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "shoulders", "quad", "hamstring", "calf"],
    safetyTip: "Keep your elbows high and chest up to support the bar across the front of your shoulders. Sit straight down between your hips — don't let your elbows drop or your torso fold forward.",
    youtubeVideoId: "NJTcg-YM-FM",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_walking_lunge",
    name: "Barbell Walking Lunge",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Take controlled steps and keep your front knee tracking over your foot, not caving inward. Keep your torso upright — don't lean forward into the step.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_hip_thrust",
    name: "Barbell Hip Thrust",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "hamstring", "groin"],
    safetyTip: "Rest the bar across your hips with a pad for comfort. Drive through your heels and squeeze your glutes at the top — don't overextend your lower back at full lockout.",
    youtubeVideoId: "3LdRSp4zAB8",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_step_up",
    name: "Barbell Step-Up",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Step fully onto the platform with your whole foot before standing up. Control the descent — don't let your trailing leg slam down or push off it to help.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_bench_press",
    name: "Dumbbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your feet flat on the floor and shoulder blades pulled back. Lower the dumbbells under control to chest level, then press up without locking out aggressively.",
    youtubeVideoId: "Fax4AiBrdO4",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_chest_fly",
    name: "Dumbbell Flyes",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep a slight bend in your elbows throughout the movement. Lower the dumbbells out to the sides under control — don't let them drop past chest level.",
    youtubeVideoId: "p87DMU7_htI",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_single_arm_row",
    name: "One-Arm Dumbbell Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Support yourself with one hand and knee on a bench, keeping your back flat. Pull the dumbbell towards your hip — don't twist your torso to help lift it.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_shrug",
    name: "Barbell Shrug",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "neck"],
    safetyTip: "Lift your shoulders straight up towards your ears, not rolling them forward or back. Keep your arms straight and avoid using momentum to jerk the weight up.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_pullover",
    name: "Dumbbell Pullover",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "back", "elbow"],
    safetyTip: "Lie across a bench with your hips low and core braced. Lower the dumbbell back behind your head with a slight bend in your elbows — don't overextend beyond a comfortable stretch.",
    youtubeVideoId: "rbSdBZemHIY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_overhead_press",
    name: "Barbell Overhead Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "back", "elbow", "neck"],
    safetyTip: "Brace your core and keep the bar path close to your face as you press. Avoid arching your lower back to get the weight up — press with your shoulders, not your spine.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_front_raise",
    name: "Dumbbell Front Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Raise the dumbbells to shoulder height with a slight bend in your elbows. Avoid swinging your torso or using momentum — control the weight on the way down.",
    youtubeVideoId: "sSsfuXTYwMQ",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_rear_delt_fly",
    name: "Dumbbell Rear Delt Fly",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "back"],
    safetyTip: "Hinge forward from the hips with a flat back. Raise the dumbbells out to the sides squeezing your shoulder blades together, not up towards your ears.",
    youtubeVideoId: "M00nnV6YnCY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_arnold_press",
    name: "Arnold Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "elbow", "neck"],
    safetyTip: "Start with palms facing you and rotate outward as you press overhead. Keep the movement smooth and controlled — don't rush the rotation or arch your lower back.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "barbell_bicep_curl",
    name: "Barbell Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Keep your elbows pinned to your sides and avoid swinging your body to lift the weight. Control the lowering phase all the way down.",
    youtubeVideoId: "eHs-fow7yEY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "dumbbell_hammer_curl",
    name: "Hammer Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Keep your palms facing each other throughout and your elbows close to your body. Avoid swinging the dumbbells — control both the lift and the lower.",
    youtubeVideoId: "mxL4lbtE2Q4",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_overhead_tricep_extension",
    name: "Standing Dumbbell Triceps Extension",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your elbows pointing forward and close to your head. Lower the dumbbell behind your head under control — don't flare your elbows out to the sides.",
    youtubeVideoId: "D01uAVxJZ5M",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_side_bend",
    name: "Dumbbell Side Bend",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Hold the dumbbell at your side and bend directly sideways, not forward or backward. Keep the movement slow and controlled — don't use momentum to swing back up.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },

  // Added 2026-08-29 — Carl picked these 24 from Unbroken Fitness
  // Solutions' "Dumbbell Exercises" library (see exercise-catalog.ts's
  // youtubeVideoId comment for the licensing reasoning) via a checklist
  // covering movements this catalog didn't have yet: mostly dumbbell
  // squat/lunge/hinge variants (the catalog only had barbell versions of
  // several of these before) plus a handful of "alternating-arm" presses
  // and curls kept as their own entries rather than folded into the
  // existing bilateral version — Carl ticked both the plain and
  // alternating video for those, a clear signal he wants both available
  // as distinct picks, not one replacing the other.
  //
  // Same DRAFT SAFETY TIPS convention as every other batch in this file —
  // written in the established voice, not yet Carl-reviewed.
  {
    key: "dumbbell_alternating_bench_press",
    name: "Alternating Dumbbell Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Press one dumbbell up while the other stays steady at chest level. Keep your core braced throughout so your torso doesn't rock side to side.",
    youtubeVideoId: "leNVSRnKxik",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_alternating_incline_press",
    name: "Alternating Dumbbell Incline Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Set the bench to a moderate incline and press one dumbbell up while the other stays steady at chest level. Keep your core braced so your torso doesn't rock.",
    youtubeVideoId: "jzbrPwcOn_w",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_neutral_grip_press",
    name: "Dumbbell Neutral Grip Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Press the dumbbells up with your palms facing each other throughout. Keep your wrists stacked over your elbows and lower under control to chest level.",
    youtubeVideoId: "S_F8GJ_OryY",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_bench_supported_narrow_row",
    name: "Bench-Supported Dumbbell Narrow Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "elbow"],
    safetyTip: "Chest supported on an incline bench, pull both dumbbells straight up towards your ribs with elbows close to your body. Avoid shrugging your shoulders up to your ears.",
    youtubeVideoId: "0ME3jhU7i4Y",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_bench_supported_wide_row",
    name: "Bench-Supported Dumbbell Wide Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Chest supported on an incline bench, pull the dumbbells out and up towards your ribs with elbows flared wide. Squeeze your shoulder blades together at the top.",
    youtubeVideoId: "gtCA_B4pSGU",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_prone_incline_row",
    name: "Dumbbell Prone Incline Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "elbow"],
    safetyTip: "Lie face-down on an incline bench and row both dumbbells up towards your ribs. Keep your chest pressed into the bench — don't let your shoulders round forward at the bottom.",
    youtubeVideoId: "6_3YdFnDlWs",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_alternating_bicep_curl",
    name: "Alternating Dumbbell Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Curl one dumbbell at a time, keeping your elbow pinned to your side. Avoid swinging your body or the resting arm to build momentum.",
    youtubeVideoId: "fsRokxfWnTc",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_concentration_curl",
    name: "Dumbbell Concentration Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Brace your elbow against the inside of your thigh and curl with a slow, controlled tempo. Avoid rocking your torso to help lift the weight.",
    youtubeVideoId: "RNYHPu68yUA",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_incline_hammer_curl",
    name: "Dumbbell Incline Hammer Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Sit back on an incline bench so your arms hang straight down. Curl with palms facing each other and avoid letting your elbows drift forward.",
    youtubeVideoId: "ekP8JdVtiRk",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_spider_curl",
    name: "Dumbbell Spider Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Lie face-down on an incline bench with your arms hanging straight down and curl with a controlled tempo. Avoid letting your elbows drift backward as you lift.",
    youtubeVideoId: "wtINfcarEAk",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_skull_crusher",
    name: "Dumbbell Skull Crusher",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Lying on a bench, lower the dumbbells towards your forehead by bending only at the elbow. Keep your upper arms still and vertical throughout.",
    youtubeVideoId: "UxDRKelKFhY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_tricep_kickback",
    name: "Dumbbell Tricep Kickback",
    muscleGroup: "arms",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Hinge forward with a flat back and keep your upper arm still, close to your body. Extend only from the elbow — don't swing the weight up with your shoulder.",
    youtubeVideoId: "LLB37Ooo148",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_front_squat",
    name: "Dumbbell Front Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "shoulders", "quad", "hamstring", "calf"],
    safetyTip: "Hold the dumbbells up at shoulder height and sit straight down between your hips. Keep your chest up and elbows high — don't let your torso fold forward.",
    youtubeVideoId: "o93yodKr1H0",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_goblet_squat",
    name: "Dumbbell Goblet Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Hold one dumbbell vertically against your chest and squat down between your knees. Keep your chest tall and elbows brushing your inner thighs at the bottom.",
    youtubeVideoId: "J_02FP1z8Eg",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_suitcase_squat",
    name: "Dumbbell Suitcase Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Hold a dumbbell in each hand at your sides like a suitcase and squat down between your knees. Keep your torso upright — don't let the weights pull you forward.",
    youtubeVideoId: "hzo9Rh1jSyI",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_split_squat",
    name: "Dumbbell Split Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Take a long stance with your feet split front to back and lower straight down. Keep most of your weight on your front leg and your front knee tracking over your foot.",
    youtubeVideoId: "loIjwi8IheU",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_bulgarian_split_squat",
    name: "Dumbbell Bulgarian Split Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Rest your rear foot on a bench behind you and lower straight down through your front leg. Keep your front knee tracking over your foot — don't let it cave inward.",
    youtubeVideoId: "bLyFixmbKcs",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_alternating_step_up",
    name: "Alternating Dumbbell Step-Up",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Step fully onto the platform with your whole foot before standing up, alternating legs each rep. Control the descent — don't let your trailing leg slam down.",
    youtubeVideoId: "yx0nWoRXS_I",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_lunge",
    name: "Dumbbell Lunge",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Step forward and lower until both knees are bent around 90 degrees. Keep your front knee tracking over your foot and push back through your front heel to return.",
    youtubeVideoId: "tP-7grkgSzo",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_reverse_lunge",
    name: "Dumbbell Reverse Lunge",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf", "groin"],
    safetyTip: "Step backward into a lunge, lowering your back knee towards the floor. Keep your front knee tracking over your foot and drive through your front heel to return.",
    youtubeVideoId: "KQ9J8tLNRTk",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_deficit_reverse_lunge",
    name: "Dumbbell Deficit Reverse Lunge",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf", "groin"],
    safetyTip: "Stand on a small platform and step back into a reverse lunge, lowering your back knee towards the floor below the step. Keep your front knee tracking over your foot.",
    youtubeVideoId: "m5euERW07gI",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_romanian_deadlift",
    name: "Dumbbell Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee", "hamstring"],
    safetyTip: "Keep the dumbbells close to your legs and your back flat. Hinge at the hips — don't round your lower back.",
    youtubeVideoId: "_m6r8WGutJY",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_hip_thrust",
    name: "Dumbbell Hip Thrust",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "hamstring", "groin"],
    safetyTip: "Rest a dumbbell across your hips with your upper back supported on a bench. Drive through your heels and squeeze your glutes at the top — don't overextend your lower back at full lockout.",
    youtubeVideoId: "45vy63uj61g",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "dumbbell_calf_raise",
    name: "Dumbbell Calf Raise",
    muscleGroup: "legs",
    avoidIfInjury: ["calf", "ankle"],
    safetyTip: "Rise up onto the balls of your feet through a full range of motion. Control the descent rather than dropping your heels — don't bounce at the bottom.",
    youtubeVideoId: "DTQFpX2bgWM",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },

  // Added 2026-08-29, same day and same source as the dumbbell batch above —
  // Carl's second checklist pass, this time Unbroken Fitness Solutions'
  // "Barbell Exercises" library. Same pattern: movements the catalog
  // didn't have a barbell version of yet, plus a couple of named-variant
  // pairs (the two box squat styles, the two bent-over row grips) kept as
  // separate entries since Carl ticked both of each pair rather than one
  // replacing the other. Same DRAFT SAFETY TIPS convention, not yet
  // Carl-reviewed.
  {
    key: "barbell_alternating_reverse_lunge",
    name: "Alternating Barbell Reverse Lunge",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf", "groin"],
    safetyTip: "Step backward into a lunge, alternating legs each rep, and lower your back knee towards the floor. Keep your front knee tracking over your foot and your torso upright.",
    youtubeVideoId: "Y3kWhb6ZMZ4",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_bent_over_row_supinated",
    name: "Barbell Bent-Over Row (Supinated Grip)",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Hinge at the hips with a flat back, gripping the bar underhand, and pull it towards your lower ribs. Avoid rounding your back or using your legs to heave the weight up.",
    youtubeVideoId: "2rY1Y9j_BiE",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_box_squat_full_sit",
    name: "Barbell Box Squat (Full Sit)",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Squat back to the box and let your hips fully relax onto it before driving back up. Keep your chest up and core braced throughout — don't round your back as you sit.",
    youtubeVideoId: "iafLfF5730s",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_box_squat_tap_and_go",
    name: "Barbell Box Squat (Tap and Go)",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Squat back until you lightly tap the box, then drive straight back up without sitting your full weight down. Keep your chest up and core braced throughout.",
    youtubeVideoId: "8NRhSq49430",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_deficit_romanian_deadlift",
    name: "Barbell Deficit Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee", "hamstring"],
    safetyTip: "Stand on a small platform to increase your range of motion and hinge at the hips with a flat back. Keep the bar close to your legs — don't round your lower back to reach the extra depth.",
    youtubeVideoId: "5pagyDq-QRc",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_inverted_row",
    name: "Barbell Inverted Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Set the bar to around waist height and hang underneath it with your body straight. Pull your chest to the bar, keeping your core braced — don't let your hips sag.",
    youtubeVideoId: "TLuODhezsg0",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "barbell_split_squat",
    name: "Barbell Split Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Take a long stance with your feet split front to back and lower straight down. Keep most of your weight on your front leg and your front knee tracking over your foot.",
    youtubeVideoId: "pY-8V89G1EI",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },

  // Added 2026-08-29 — Carl's third checklist pass, this time picking from
  // both Unbroken Fitness Solutions' "Cables & Machines" and "Kettlebell
  // Exercises" libraries at once. Same DRAFT SAFETY TIPS convention, not
  // yet Carl-reviewed. Cable entries below are all cable_machine; the
  // kettlebell entries need the new "kettlebells" requiredEquipment/
  // EQUIPMENT_TYPES value (types.ts, and its duplicate in podHq's
  // src/lib/data/types.ts) — first time this catalog has anything beyond
  // the original 4 equipment categories, so these exercises won't be
  // offered anywhere until Carl actually marks a gym's pod_resources.equipment
  // as having kettlebells (a real physical-equipment question, not
  // something this catalog change can answer on its own).
  {
    key: "cable_bicep_curl",
    name: "Cable Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Keep your elbows close to your body and avoid swinging the weight. Control the lowering phase throughout.",
    youtubeVideoId: "_HrQpdTi2kY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_hammer_curl",
    name: "Cable Hammer Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist"],
    safetyTip: "Keep your palms facing each other throughout and your elbows close to your body. Avoid swinging the weight — control both the lift and the lower.",
    youtubeVideoId: "pEOQsendlK4",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_lat_pullover",
    name: "Cable Lat Pullover",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Stand facing the cable with a straight bar and pull it down in an arc to your thighs, keeping your arms mostly straight. Avoid using your body weight to heave the bar down.",
    youtubeVideoId: "KVgjqo0p5mY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_reverse_grip_tricep_extension",
    name: "Cable Reverse-Grip Tricep Extension",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Grip the bar underhand and keep your elbows pinned to your sides throughout. Extend fully without letting your elbows drift forward.",
    youtubeVideoId: "yuIiei-D3ks",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_rope_tricep_extension",
    name: "Cable Rope Tricep Extension",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your elbows pinned to your sides and split the rope apart as you extend. Avoid leaning your whole body into the movement.",
    youtubeVideoId: "5AjzNU1SK5A",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_arm_tricep_pushdown",
    name: "Single-Arm Cable Tricep Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your elbow pinned to your side and push the handle straight down until your arm is fully extended. Avoid leaning your whole body into the movement.",
    youtubeVideoId: "GxTm0x07Gbo",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_rotation_high_to_low",
    name: "Cable Rotation (High to Low)",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Rotate your torso from high to low using your core, keeping your arms relatively straight and hips facing forward. Control the movement rather than yanking the weight down.",
    youtubeVideoId: "kge1ZiEiUeE",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_rotation_low_to_high",
    name: "Cable Rotation (Low to High)",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Rotate your torso from low to high using your core, keeping your arms relatively straight and hips facing forward. Control the movement rather than yanking the weight up.",
    youtubeVideoId: "KSH6IEiKWjE",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_arm_chest_supported_row",
    name: "Cable Single-Arm Chest-Supported Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "elbow"],
    safetyTip: "Support your chest against a bench or pad and row one handle towards your hip. Keep your shoulder down — don't shrug up towards your ear as you pull.",
    youtubeVideoId: "l8lgVBjwD08",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_arm_low_row",
    name: "Single-Arm Cable Low Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "elbow"],
    safetyTip: "Sit tall and pull the handle towards your hip, keeping your back straight. Avoid leaning back excessively or using momentum to move the weight.",
    youtubeVideoId: "79EoDDehUoA",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_leg_kickback",
    name: "Cable Single Leg Kickback",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "hamstring"],
    safetyTip: "Hinge slightly forward and kick one leg straight back, squeezing your glute at the top. Keep your standing leg soft and avoid arching your lower back.",
    youtubeVideoId: "cbmmp8UGUVg",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_leg_romanian_deadlift",
    name: "Cable Single-Leg Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee", "hamstring"],
    safetyTip: "Hinge at the hips on one leg, keeping your back flat and the other leg extending straight behind you for balance. Don't round your lower back to reach further.",
    youtubeVideoId: "YypHtX2qvk0",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_arm_lateral_raise",
    name: "Single-Arm Cable Lateral Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Raise the handle out to shoulder height with a slight bend in your elbow. Avoid using your body to swing the weight up — control it on the way down.",
    youtubeVideoId: "7IHXXAXEqss",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_single_arm_reverse_fly",
    name: "Single-Arm Cable Reverse Fly",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "back"],
    safetyTip: "Hinge forward slightly and pull the handle out and back, squeezing your shoulder blade. Keep a slight bend in your elbow throughout — don't yank the weight with momentum.",
    youtubeVideoId: "WKbbDpZo49g",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_chest_press",
    name: "Standing Cable Chest Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Stand in a staggered stance and press the handles forward until your arms are extended. Keep a slight bend in your elbows at full extension — don't lock out aggressively.",
    youtubeVideoId: "3zcb_9plUM4",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "kettlebell_double_arm_swing",
    name: "Double-Arm Kettlebell Swing",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "hamstring", "groin"],
    safetyTip: "Hinge at the hips and swing the kettlebell up to shoulder height using your hips, not your arms. Keep your back flat throughout — don't round forward as you hinge.",
    youtubeVideoId: "qoxJxTc9FD8",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_alternating_swing",
    name: "Alternating Arm Kettlebell Swing",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "hamstring", "groin"],
    safetyTip: "Hinge at the hips and swing the kettlebell up to shoulder height, switching hands at the top of each rep. Keep your back flat throughout — don't round forward as you hinge.",
    youtubeVideoId: "9x_JA84vgnk",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_double_arm_clean",
    name: "Double-Arm Kettlebell Clean",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "shoulders", "wrist", "elbow"],
    safetyTip: "Hinge and drive the kettlebells up to your shoulders in one smooth motion, keeping them close to your body. Avoid banging the bells hard into your wrists at the top — let your elbows rotate through.",
    youtubeVideoId: "PR62CSAHM1Y",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_power_clean_and_press",
    name: "Kettlebell Power Clean and Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["back", "shoulders", "wrist", "elbow"],
    safetyTip: "Clean the kettlebells to your shoulders with a hip drive, then press straight overhead. Brace your core throughout and avoid arching your lower back on the press.",
    youtubeVideoId: "zZj4m30r6cE",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_high_plank_drag",
    name: "High Plank Kettlebell Drag",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders", "wrist"],
    safetyTip: "Hold a high plank and drag the kettlebell under your body from side to side. Keep your hips level and avoid rotating or sagging as you reach.",
    youtubeVideoId: "GTS8rOmIFkA",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_around_the_body",
    name: "Kettlebell Around the Body",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Pass the kettlebell around your waist hand to hand, keeping your core braced throughout. Control the pace — don't let the weight swing you off balance.",
    youtubeVideoId: "hVFIG5rnPfY",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_bottoms_up_press",
    name: "Kettlebell Bottoms-Up Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "elbow", "neck"],
    safetyTip: "Hold the kettlebell upside down by the handle and press overhead, gripping tightly to keep it stable. Start light — this demands real wrist and shoulder control before adding load.",
    youtubeVideoId: "5tG5bKNbSWo",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_goblet_box_squat",
    name: "Kettlebell Goblet Box Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Hold the kettlebell vertically against your chest and squat back to lightly touch the box before standing back up. Keep your chest tall — don't round forward as you sit back.",
    youtubeVideoId: "LwfHkyRpy1s",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_goblet_squat",
    name: "Kettlebell Goblet Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Hold the kettlebell vertically against your chest and squat down between your knees. Keep your chest tall and elbows brushing your inner thighs at the bottom.",
    youtubeVideoId: "La5NnrZqJoA",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_halo",
    name: "Kettlebell Halo",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders", "back", "neck"],
    safetyTip: "Circle the kettlebell around your head close to your skull, keeping your core braced and ribcage still. Alternate direction between sets and keep the movement slow and controlled.",
    youtubeVideoId: "lFLg0nPSP8k",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_russian_twist",
    name: "Kettlebell Russian Twist",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Sit with your knees bent and lean back slightly, keeping your back straight. Rotate the kettlebell side to side under control — don't just swing your arms.",
    youtubeVideoId: "wEQHyOaj_dQ",
    youtubeEndSeconds: 10,
    isCompound: false,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_squat_clean_and_press",
    name: "Kettlebell Squat Clean and Press",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee", "shoulders", "quad", "hamstring", "calf", "wrist", "elbow"],
    safetyTip: "Squat down to pick up the kettlebell, clean it to your shoulder as you stand, then press overhead. Keep your core braced throughout each phase of the lift.",
    youtubeVideoId: "qzvEYPzcWng",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    key: "kettlebell_sumo_deadlift",
    name: "Kettlebell Sumo Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee", "hamstring", "groin", "quad"],
    safetyTip: "Stand with a wide stance and the kettlebell between your feet. Hinge and grip the handle, keeping your back flat and chest up as you stand tall.",
    youtubeVideoId: "qLmx9IM1ZyQ",
    youtubeEndSeconds: 10,
    isCompound: true,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  // Real bodyweight HIIT/CrossFit staples (2026-08-29, Carl's call —
  // researched against actual published CrossFit/HIIT programming, not
  // guessed) — the "Cardio" half of "Build your own"'s Weights/Cardio
  // split. No requiredEquipment: every pod has these regardless of
  // configured kit. No youtubeVideoId — outside the four Unbroken Fitness
  // Solutions equipment categories sourced earlier this session; follow
  // the safety tip until real technique videos are found for these.
  {
    key: "burpee",
    name: "Burpee",
    muscleGroup: "full_body",
    avoidIfInjury: ["knee", "wrist", "shoulders"],
    safetyTip: "Land softly on the push-up and the jump — don't let your hips sag in the plank, and keep landings quiet and controlled rather than jarring.",
    isCompound: true,
    isConditioning: true,
    requiredEquipment: null,
  },
  {
    key: "mountain_climbers",
    name: "Mountain Climbers",
    muscleGroup: "core",
    avoidIfInjury: ["wrist"],
    safetyTip: "Keep your hips level and core braced — don't let them pike up or sag. Hands stay stacked under your shoulders throughout.",
    isCompound: true,
    isConditioning: true,
    requiredEquipment: null,
  },
  {
    key: "jumping_jacks",
    name: "Jumping Jacks",
    muscleGroup: "full_body",
    avoidIfInjury: ["knee", "ankle", "calf"],
    safetyTip: "Land with soft knees, not flat-footed. Keep a slight bend throughout rather than locking your knees on each landing.",
    isCompound: true,
    isConditioning: true,
    requiredEquipment: null,
  },
  {
    key: "high_knees",
    name: "High Knees",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "hip", "calf", "hamstring"],
    safetyTip: "Drive from the hip, not just the lower leg, and land midfoot under your body rather than reaching out in front.",
    isCompound: true,
    isConditioning: true,
    requiredEquipment: null,
  },
  {
    key: "jump_squats",
    name: "Jump Squats",
    muscleGroup: "legs",
    avoidIfInjury: ["knee", "back", "quad", "hamstring", "calf"],
    safetyTip: "Land in the same squat position you jumped from — knees tracking over toes, not caving in — before the next rep.",
    isCompound: true,
    isConditioning: true,
    requiredEquipment: null,
  },
  {
    key: "plank_jacks",
    name: "Plank Jacks",
    muscleGroup: "core",
    avoidIfInjury: ["wrist", "knee"],
    safetyTip: "Keep your core braced and hips level as your feet jack in and out — don't let your hips rise up or sag throughout.",
    isCompound: true,
    isConditioning: true,
    requiredEquipment: null,
  },
  // Everything below added 2026-09-06 for Carl's own technique-video
  // shoot, alongside lat_pulldown_v_grip/lat_pulldown_double_handle above.
  // DRAFT safetyTip on every entry — Carl to review/rewrite before these
  // go live, per this file's own convention that safety cues are
  // human-written, not LLM-generated. Higher stakes than usual: these pods
  // are unmanned (no staff supervision), so a bad safety tip here has no
  // human backstop.
  {
    // Promoted from a clip that would otherwise have been discarded when
    // "plank" only had room for one video (Full Plank won that slot).
    key: "plank_elbow",
    name: "Elbow Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders"],
    safetyTip: "Rest on your forearms with elbows under your shoulders. Keep your body in a straight line from head to heels — don't let your hips sag or pike up.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: null,
  },
  {
    key: "side_plank",
    name: "Side Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders", "wrist"],
    safetyTip: "Stack your feet and prop up on one forearm, keeping your body in a straight line. Don't let your hips drop toward the floor.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: null,
  },
  {
    // Promoted from a clip that lost the cable_single_arm_lateral_raise
    // slot to the leaning variant — same movement family, standing stance.
    key: "cable_lateral_raise_standing",
    name: "Standing Cable Lateral Raise",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    safetyTip: "Raise the handle out to shoulder height with a slight bend in your elbow, standing tall throughout. Avoid using your body to swing the weight up — control it on the way down.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    // Promoted from a clip that lost the kettlebell_alternating_swing slot
    // — same hinge pattern, one arm throughout instead of alternating.
    // isCompound: false, unlike its two swing siblings above — same
    // hip-hinge pattern as kettlebell_double_arm_swing/
    // kettlebell_alternating_swing, differing only in arm usage. See
    // lat_pulldown_v_grip's comment for why a same-pattern variant
    // shouldn't also carry the compound flag.
    key: "kettlebell_single_arm_swing",
    name: "Single-Arm Kettlebell Swing",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "hamstring", "groin"],
    safetyTip: "Hinge at the hips and swing the kettlebell up to shoulder height using your hips, not your arms, keeping the same hand throughout the set. Keep your back flat throughout — don't round forward as you hinge.",
    isCompound: false,
    isConditioning: true,
    requiredEquipment: "kettlebells",
  },
  {
    // Promoted from the clip that lost the cable_rope_tricep_extension
    // slot to the overhead-extension clip — this is the plain pushdown.
    key: "cable_rope_pushdown",
    name: "Cable Rope Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your elbows pinned to your sides and push the rope down and apart at the bottom. Avoid leaning your whole body into the movement.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "barbell_incline_bench_press",
    name: "Barbell Incline Bench Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Feet flat on the floor, shoulder blades pulled back. Control the bar down to your upper chest — don't bounce it.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "barbell_rack",
  },
  {
    key: "cable_behind_back_curl",
    name: "Behind-the-Back Cable Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist", "shoulders"],
    safetyTip: "Stand facing away from the low pulley, keeping your elbow pinned behind your hip as you curl. Avoid swinging your torso to generate momentum.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_hip_abduction",
    name: "Cable Hip Abduction",
    muscleGroup: "legs",
    avoidIfInjury: ["hip", "groin", "knee"],
    safetyTip: "Attach the cuff to your ankle and stand side-on to the machine, keeping your leg straight as you lift it out to the side. Avoid leaning your torso to swing the leg.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "cable_hip_adduction",
    name: "Cable Hip Adduction",
    muscleGroup: "legs",
    avoidIfInjury: ["hip", "groin", "knee"],
    safetyTip: "Attach the cuff to your ankle and stand side-on to the machine, pulling your leg across your body under control. Avoid leaning your torso to generate momentum.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "dumbbell_cross_body_tricep_extension",
    name: "Cross-Body Dumbbell Triceps Extension",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders", "elbow"],
    safetyTip: "Keep your upper arm close to your body as you extend the dumbbell across and down. Control the weight on the way back up — don't let it drop.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "bicycle_crunches",
    name: "Bicycle Crunches",
    muscleGroup: "core",
    avoidIfInjury: ["back", "neck"],
    safetyTip: "Bring opposite elbow to opposite knee in a smooth pedalling motion, keeping your lower back pressed into the floor. Avoid pulling on your neck with your hands.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: null,
  },
  {
    key: "crunches",
    name: "Crunches",
    muscleGroup: "core",
    avoidIfInjury: ["back", "neck"],
    safetyTip: "Curl your shoulders off the floor towards your hips, keeping your lower back pressed down. Avoid pulling on your neck with your hands.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: null,
  },
  {
    key: "dumbbell_incline_curl",
    name: "Incline Dumbbell Curl",
    muscleGroup: "arms",
    avoidIfInjury: ["elbow", "wrist", "shoulders"],
    safetyTip: "Sit back on an incline bench and let your arms hang straight down, curling with your palms facing up. Avoid letting your elbows drift forward as you lift.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "dumbbells",
  },
  {
    key: "lying_leg_raises",
    name: "Lying Leg Raises",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Lie flat and lower your legs under control without your lower back arching off the floor. Stop the descent before your back lifts.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: null,
  },
  {
    key: "pallof_press",
    name: "Pallof Press",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders"],
    safetyTip: "Stand side-on to the cable and press the handle straight out from your chest, resisting the pull rotating your torso. Keep your hips and shoulders square throughout.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "pallof_press_hold",
    name: "Pallof Press Hold",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders"],
    safetyTip: "Press the handle out from your chest and hold, bracing your core to resist the cable pulling you to rotate. Keep breathing normally throughout the hold.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "standing_cable_row",
    name: "Standing Cable Row",
    muscleGroup: "back",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Stand tall and pull the handle to your torso, squeezing your shoulder blades together. Avoid leaning back excessively or using momentum.",
    isCompound: true,
    isConditioning: false,
    requiredEquipment: "cable_machine",
  },
  {
    key: "windscreen_wipers",
    name: "Windscreen Wipers",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    safetyTip: "Lie on your back with legs raised and lower them slowly side to side, keeping your shoulders flat on the floor. Stop the range where you can keep control — don't force it further.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: null,
  },
  {
    key: "hanging_knee_raise",
    name: "Hanging Knee Raise",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Hang with a straight grip and raise your knees towards your chest without swinging. Avoid using momentum to throw your legs up.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "pull_up_bar",
  },
  {
    key: "hanging_leg_raise",
    name: "Hanging Leg Raise",
    muscleGroup: "core",
    avoidIfInjury: ["back", "shoulders", "elbow"],
    safetyTip: "Hang with a straight grip and raise your legs straight out in front without swinging. Avoid using momentum to throw your legs up.",
    isCompound: false,
    isConditioning: false,
    requiredEquipment: "pull_up_bar",
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

// undefined start/end are both valid — the YouTube embed just plays the
// full clip when neither is set, same as before this existed.
export function getYoutubeEmbedTiming(key: string): { start?: number; end?: number } {
  const exercise = EXERCISE_CATALOG.find((e) => e.key === key);
  return { start: exercise?.youtubeStartSeconds, end: exercise?.youtubeEndSeconds };
}
