// Fixed, hand-written warm-up/cool-down content — same "reviewed,
// written by a person, never LLM-generated" convention this app already
// uses for exercise safetyTip content (exercise-catalog.ts). This is a
// generic starting draft, not gym-specific — flagged for Carl to review
// or replace before it's treated as final. No weight/reps tracking:
// these are presentational checklist items, not logged sets.
export interface WarmupCooldownItem {
  name: string;
  instruction: string;
}

export const WARMUP_ITEMS: WarmupCooldownItem[] = [
  { name: "Marching in place", instruction: "1 minute — get the blood flowing before you pick up anything heavy." },
  { name: "Arm circles", instruction: "30 seconds each direction — loosen the shoulders before pressing and pulling." },
  { name: "Bodyweight squats", instruction: "10 reps — wake up the hips and legs before loaded lifting." },
  { name: "Torso twists", instruction: "10 each side — mobilise the spine." },
];

export const COOLDOWN_ITEMS: WarmupCooldownItem[] = [
  { name: "Standing quad stretch", instruction: "30 seconds each leg." },
  { name: "Standing hamstring stretch", instruction: "30 seconds each leg." },
  { name: "Chest doorway stretch", instruction: "30 seconds each side." },
  { name: "Deep breathing", instruction: "1 minute — bring your heart rate down before you head off." },
];
