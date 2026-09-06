// Fixed, hand-written warm-up/cool-down content — same "reviewed,
// written by a person, never LLM-generated" convention this app already
// uses for exercise safetyTip content (exercise-catalog.ts). Carl-
// reviewed 2026-08-23: the pulse raiser uses the pod's actual Peloton
// treadmill/bike (correcting exercise-catalog.ts's own equipment
// comment, which only listed the resistance-training kit — that comment
// needs updating too), the rest is bodyweight. No weight/reps tracking:
// these are presentational checklist items, not logged sets.
//
// `key` added 2026-09-06 so items can carry Carl's own technique videos
// through the same exercise_video_overrides store EXERCISE_CATALOG uses
// (that store has no FK to either list — it's just a generic string-keyed
// lookup, see 0085_exercise_video_overrides.sql) — workout-view.tsx looks
// each key up via useExerciseVideoOverrides(). Optional: an item with no
// filmed clip just renders without a video, same as an unset key today.
export interface WarmupCooldownItem {
  key: string;
  name: string;
  instruction: string;
}

export const WARMUP_ITEMS: WarmupCooldownItem[] = [
  { key: "warmup_bike_treadmill", name: "Easy pace on the bike or treadmill", instruction: "2 minutes — get the blood flowing before you pick up anything heavy." },
  { key: "arm_circles", name: "Arm circles", instruction: "30 seconds each direction — loosen the shoulders before pressing and pulling." },
  { key: "bodyweight_squats", name: "Bodyweight squats", instruction: "10 reps — wake up the hips and legs before loaded lifting." },
  { key: "fire_hydrants", name: "Fire hydrants", instruction: "10 each side — open up the hips before squats and deadlifts." },
  { key: "torso_twists", name: "Torso twists", instruction: "10 each side — mobilise the spine." },
  // DRAFT instructions below — Carl to review, per this file's own
  // human-written convention. Added 2026-09-06 alongside Carl's own
  // filmed clips.
  { key: "cat_cow", name: "Cat-cow", instruction: "10 slow reps — mobilise the spine before you load it." },
  { key: "hamstring_sweep", name: "Hamstring sweep", instruction: "10 each leg — dynamically stretch the hamstrings before you load them." },
];

export const COOLDOWN_ITEMS: WarmupCooldownItem[] = [
  { key: "standing_quad_stretch", name: "Standing quad stretch", instruction: "30 seconds each leg." },
  { key: "standing_hamstring_stretch", name: "Standing hamstring stretch", instruction: "30 seconds each leg." },
  { key: "chest_doorway_stretch", name: "Chest doorway stretch", instruction: "30 seconds each side." },
  { key: "deep_breathing", name: "Deep breathing", instruction: "1 minute — bring your heart rate down before you head off." },
  // DRAFT instructions below — Carl to review, per this file's own
  // human-written convention. Added 2026-09-06 alongside Carl's own
  // filmed clips.
  { key: "calf_stretch", name: "Calf stretch", instruction: "30 seconds each leg." },
  { key: "glute_stretch", name: "Glute stretch", instruction: "30 seconds each side." },
  { key: "hip_flexor_stretch", name: "Hip flexor stretch", instruction: "30 seconds each side." },
  { key: "lat_stretch", name: "Lat stretch", instruction: "30 seconds each side." },
  { key: "pigeon_pose", name: "Pigeon pose", instruction: "30 seconds each side." },
];
