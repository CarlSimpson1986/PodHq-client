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

// uk_food_composition (PHE's CoFID dataset) is a raw-ingredient
// reference table, not a recipe/meal database — "Butter, salted" and
// "Oil, vegetable" are real rows in it, and a pure nearest-fit-on-
// calories search happily suggested them, since a tiny quantity of pure
// fat is calorie-dense enough to "fit" almost any remaining budget
// (Carl, 2026-08-25: "the meal ideas are cooking oil and butter wtf").
// Filtered here rather than fixed by scoring alone — a food that's
// mostly fat with negligible protein AND negligible carbs is a cooking
// ingredient, not something anyone would eat as a meal/snack on its own.
// A short name-based denylist backstops the numeric filter for edge
// cases (e.g. flavoured oils/spreads whose macros aren't quite as
// extreme as plain oil).
const NON_MEAL_NAME_PATTERN = /\b(oil|butter|lard|ghee|margarine|dripping|shortening|suet)\b/i;

function isRealMealCandidate(row: { protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; food_name: string }): boolean {
  if (NON_MEAL_NAME_PATTERN.test(row.food_name)) return false;
  // Near-zero protein AND near-zero carbs means the calories are almost
  // entirely fat — a cooking ingredient/condiment, not a food to suggest
  // eating on its own.
  if (row.protein_per_100g < 3 && row.carbs_per_100g < 3) return false;
  return true;
}

interface ScoredCandidate {
  suggestion: MealSuggestion;
  score: number;
  proteinPer100g: number;
  carbsPer100g: number;
}

// v1: a nearest-fit search over uk_food_composition (~2,900 rows, already
// a full-table-scan-accepted size per that migration's own comment), not
// a real recipe generator — there's no dish-level data to draw on, so
// suggestions are always single whole foods (chicken breast, rice,
// yoghurt), never composed dishes. Picks one protein-forward item + one
// carb-forward item when the remaining budget genuinely needs both —
// reads as a mini-meal pairing rather than two unrelated foods — falling
// back to pure nearest-fit when it doesn't. Randomised each call so
// "Regenerate" gives different results without needing separate state.
export async function getMealSuggestions(remaining: RemainingBudget): Promise<MealSuggestion[]> {
  if (remaining.calories <= 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("uk_food_composition")
    .select("food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g");
  if (error) throw new Error(error.message);

  const scored: ScoredCandidate[] = [];
  for (const row of data ?? []) {
    if (!isRealMealCandidate(row)) continue;

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
        proteinPer100g: row.protein_per_100g,
        carbsPer100g: row.carbs_per_100g,
      });
    }
  }

  scored.sort((a, b) => a.score - b.score);
  const top = scored.slice(0, 20).sort(() => Math.random() - 0.5);

  const picked: MealSuggestion[] = [];
  const usedNames = new Set<string>();

  function take(pool: ScoredCandidate[]): boolean {
    const candidate = pool.find((c) => !usedNames.has(c.suggestion.foodName));
    if (!candidate) return false;
    usedNames.add(candidate.suggestion.foodName);
    picked.push(candidate.suggestion);
    return true;
  }

  // Meal-pairing mode: budget genuinely needs both protein and carbs, so
  // pick one item that's clearly protein-forward and one that's clearly
  // carb-forward, rather than two items that both happen to fit calories.
  if (remaining.proteinG >= 10 && remaining.carbsG >= 10) {
    const proteinForward = top.filter((c) => c.proteinPer100g >= 12).sort((a, b) => a.score - b.score);
    const carbForward = top.filter((c) => c.carbsPer100g >= 15).sort((a, b) => a.score - b.score);
    take(proteinForward);
    take(carbForward);
  }

  while (picked.length < SUGGESTION_COUNT && take(top)) {
    // top is already nearest-fit sorted-then-shuffled; take() skips duplicates.
  }

  return picked;
}
