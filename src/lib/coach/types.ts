// TS-union validation for coach_profiles' text columns rather than a DB
// CHECK constraint — same convention as pod_resources.credit_type and
// waitlist_entries.status elsewhere in this shared schema (see
// 0048_coach_profiles.sql's comment).

export const GOALS = ["weight_loss", "muscle_gain", "fitness", "strength"] as const;
export type Goal = (typeof GOALS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

// 1-5, stored as workout_sets.rpe. Effortless/Easy trend the next
// suggested weight up, Just Right holds it, Hard/Killer hold or trend it
// down — see generate-workout.ts.
export const RPE_SCALE: { value: number; label: string }[] = [
  { value: 1, label: "Effortless" },
  { value: 2, label: "Easy" },
  { value: 3, label: "Just Right" },
  { value: 4, label: "Hard" },
  { value: 5, label: "Killer" },
];
