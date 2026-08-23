import type { CoachProfile } from "@/lib/coach/coach-profile";
import {
  PROTEIN_TARGET_G_PER_KG,
  CALORIE_TARGET_FLOOR,
  FAT_PERCENT_OF_TARGET,
  ACTIVITY_MULTIPLIER_BY_SESSIONS_PER_WEEK,
} from "@/lib/coach/types";

export interface NutritionTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Harris-Benedict — the formula MyFitPod-App-Brief.docx specifies (see
// coach-profile.ts's validation comment). Recent literature generally
// favours Mifflin-St Jeor as more accurate for a typical sedentary
// population (Harris-Benedict tends to overestimate BMR by 5-15% there),
// so this is a documented, revisitable spec choice, not an unexamined
// default.
function harrisBenedictBmr(weightKg: number, heightCm: number, age: number, gender: string | null): number {
  const male = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  const female = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  if (gender === "Male") return male;
  if (gender === "Female") return female;
  // null / "Prefer not to say" / "Other" — average of both formulas rather
  // than blocking the feature or guessing a gender.
  return (male + female) / 2;
}

// Returns null when the profile is missing a body stat it needs — the DB
// columns stay nullable even though onboarding now requires them (Stage 5
// fix), so a profile created before that fix could still be incomplete.
export function computeNutritionTargets(profile: CoachProfile, gender: string | null): NutritionTargets | null {
  const { weight_kg: weightKg, height_cm: heightCm, age, sessions_per_week: sessionsPerWeek, goal } = profile;
  if (weightKg === null || heightCm === null || age === null) return null;

  const bmr = harrisBenedictBmr(weightKg, heightCm, age, gender);
  const activityMultiplier = ACTIVITY_MULTIPLIER_BY_SESSIONS_PER_WEEK[sessionsPerWeek] ?? 1.55;
  const tdee = bmr * activityMultiplier;

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
