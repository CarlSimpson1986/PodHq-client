import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MealSuggestion {
  foodName: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  // Per-100g values, carried through so the "+ Add" action can log this
  // suggestion via the existing POST /api/member/nutrition/log endpoint
  // (logFoodSchema expects per-100g values + quantity, not scaled totals).
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export interface RemainingBudget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const CANDIDATE_QUANTITIES = [100, 150, 200];
const SUGGESTION_COUNT = 2;

// v1: a simple nearest-fit search over uk_food_composition (~2,900 rows,
// already a full-table-scan-accepted size per that migration's own
// comment), not a real optimizer — scores each (food, quantity) candidate
// by distance from the remaining macro budget, weighting protein more
// heavily since that's usually the harder target to hit. Picks 2 distinct
// foods from the top-scoring candidates, randomised each call so
// "Regenerate" gives different results without needing separate state.
export async function getMealSuggestions(remaining: RemainingBudget): Promise<MealSuggestion[]> {
  if (remaining.calories <= 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("uk_food_composition")
    .select("food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g");
  if (error) throw new Error(error.message);

  const scored: { suggestion: MealSuggestion; score: number }[] = [];
  for (const row of data ?? []) {
    for (const qty of CANDIDATE_QUANTITIES) {
      const scale = qty / 100;
      const calories = row.calories_per_100g * scale;
      // Don't suggest something that alone would blow the remaining budget.
      if (calories > remaining.calories * 1.15) continue;

      const proteinG = row.protein_per_100g * scale;
      const carbsG = row.carbs_per_100g * scale;
      const fatG = row.fat_per_100g * scale;
      const score = Math.abs(calories - remaining.calories) + Math.abs(proteinG - remaining.proteinG) * 2;

      scored.push({
        suggestion: {
          foodName: row.food_name,
          quantityG: qty,
          calories: Math.round(calories),
          proteinG: Math.round(proteinG),
          carbsG: Math.round(carbsG),
          fatG: Math.round(fatG),
          caloriesPer100g: row.calories_per_100g,
          proteinPer100g: row.protein_per_100g,
          carbsPer100g: row.carbs_per_100g,
          fatPer100g: row.fat_per_100g,
        },
        score,
      });
    }
  }

  scored.sort((a, b) => a.score - b.score);
  const top = scored.slice(0, 15).sort(() => Math.random() - 0.5);

  const picked: MealSuggestion[] = [];
  const usedNames = new Set<string>();
  for (const item of top) {
    if (usedNames.has(item.suggestion.foodName)) continue;
    usedNames.add(item.suggestion.foodName);
    picked.push(item.suggestion);
    if (picked.length === SUGGESTION_COUNT) break;
  }
  return picked;
}
