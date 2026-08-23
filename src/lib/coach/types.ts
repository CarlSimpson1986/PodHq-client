// TS-union validation for coach_profiles' text columns rather than a DB
// CHECK constraint — same convention as pod_resources.credit_type and
// waitlist_entries.status elsewhere in this shared schema (see
// 0048_coach_profiles.sql's comment).

export const GOALS = ["weight_loss", "muscle_gain", "fitness", "strength"] as const;
export type Goal = (typeof GOALS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const FOOD_PREFERENCES = ["none", "vegetarian", "vegan", "pescatarian", "halal", "other"] as const;
export type FoodPreference = (typeof FOOD_PREFERENCES)[number];

// Daily protein target — flat 1.8g/kg bodyweight, Carl's call (2026-08-23):
// evidence-based consensus for exercising adults is 1.4-2.2g/kg, with the
// commonly-cited plateau for muscle-building benefit around 1.6g/kg
// (Morton et al. 2018 meta-analysis); 1.8g/kg sits a bit above that
// plateau without going to the "1g/lb" ceiling some gym culture defaults
// to — deliberately not goal-differentiated, since this member base isn't
// competitive bodybuilders and a single simple number is the point.
export const PROTEIN_TARGET_G_PER_KG = 1.8;

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
