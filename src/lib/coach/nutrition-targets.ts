import type { CoachProfile } from "@/lib/coach/coach-profile";
import {
  PROTEIN_TARGET_G_PER_KG,
  CALORIE_TARGET_FLOOR,
  FAT_PERCENT_OF_TARGET,
  ACTIVITY_MULTIPLIER_BY_DAILY_ACTIVITY_LEVEL,
} from "@/lib/coach/types";

export interface NutritionTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Mifflin-St Jeor — swapped from Harris-Benedict (2026-08-29). Modern
// literature (and the US Academy of Nutrition and Dietetics) treats this
// as more accurate for a typical population; Harris-Benedict tends to
// overestimate BMR by 5-15%. That gap was already flagged as a documented,
// revisitable spec choice before this swap — see this file's own git
// history for the original Harris-Benedict version.
function mifflinStJeorBmr(weightKg: number, heightCm: number, age: number, gender: string | null): number {
  const male = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const female = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  if (gender === "Male") return male;
  if (gender === "Female") return female;
  // null / "Prefer not to say" / "Other" — average of both formulas rather
  // than blocking the feature or guessing a gender.
  return (male + female) / 2;
}

// Returns null when the profile is missing a body stat (or, since
// 2026-08-29, daily_activity_level) it needs — the DB columns stay
// nullable even though onboarding now requires them, so a profile created
// before a given field existed could still be incomplete.
export function computeNutritionTargets(profile: CoachProfile, gender: string | null): NutritionTargets | null {
  const {
    weight_kg: weightKg,
    height_cm: heightCm,
    age,
    goal,
    daily_activity_level: activityLevel,
  } = profile;
  if (weightKg === null || heightCm === null || age === null || activityLevel === null) return null;

  const bmr = mifflinStJeorBmr(weightKg, heightCm, age, gender);

  // daily_activity_level alone drives TDEE — see types.ts's
  // ACTIVITY_MULTIPLIER_BY_DAILY_ACTIVITY_LEVEL for why sessions_per_week
  // has no calorie contribution here at all (Carl's call, 2026-08-29).
  const tdee = bmr * ACTIVITY_MULTIPLIER_BY_DAILY_ACTIVITY_LEVEL[activityLevel];

  const rawCalorieTarget = goal === "weight_loss" ? tdee - 500 : goal === "muscle_gain" ? tdee + 300 : tdee;
  const calories = Math.max(rawCalorieTarget, CALORIE_TARGET_FLOOR);

  const proteinG = weightKg * PROTEIN_TARGET_G_PER_KG;
  const fatG = (calories * FAT_PERCENT_OF_TARGET) / 9;
  // Defensive floor for a heavier member on an aggressive deficit, where
  // protein + fat calories alone could otherwise approach or exceed the
  // calorie target and drive carbs negative — same "belt and suspenders"
  // style as generate-workout.ts's null-RPE handling.
  const carbsG = Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4);

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  };
}
