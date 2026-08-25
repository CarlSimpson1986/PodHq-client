import type { Meal } from "@/lib/coach/types";
import { MEAL_CATALOG, type MealCatalogEntry } from "@/lib/coach/meal-catalog";

export interface MealSuggestion {
  meal: Meal;
  name: string;
  description: string;
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

const MEAL_PRIORITY: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];
const SUGGESTION_COUNT = 2;

function toSuggestion(entry: MealCatalogEntry): MealSuggestion {
  const scale = 100 / entry.quantityG;
  return {
    meal: entry.meal,
    name: entry.name,
    description: entry.description,
    quantityG: entry.quantityG,
    calories: entry.calories,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    caloriesPer100g: Math.round(entry.calories * scale * 10) / 10,
    proteinPer100g: Math.round(entry.proteinG * scale * 10) / 10,
    carbsPer100g: Math.round(entry.carbsG * scale * 10) / 10,
    fatPer100g: Math.round(entry.fatG * scale * 10) / 10,
  };
}

function scoreAgainstBudget(entry: MealCatalogEntry, remaining: RemainingBudget): number {
  return Math.abs(entry.calories - remaining.calories) + Math.abs(entry.proteinG - remaining.proteinG) * 2;
}

// Real composed meals from the hand-written MEAL_CATALOG (not a raw-
// ingredient search — see that file's comment for why), meal-slot aware:
// prioritises whichever meal(s) haven't been logged today yet, in
// breakfast → lunch → dinner → snacks order, so "What to eat next" reads
// as an actual next-meal suggestion rather than two unrelated items.
// Falls back to snacks once every slot already has an entry. Picks
// randomly among each slot's closest-fitting options so "Regenerate"
// gives different results without needing separate state.
export function getMealSuggestions(remaining: RemainingBudget, loggedMeals: Meal[]): MealSuggestion[] {
  if (remaining.calories <= 0) return [];

  const loggedSet = new Set(loggedMeals);
  const targetSlots = MEAL_PRIORITY.filter((m) => !loggedSet.has(m));
  const slotsToTry = targetSlots.length > 0 ? targetSlots : (["snacks"] as Meal[]);

  const picked: MealSuggestion[] = [];
  const usedNames = new Set<string>();

  function pickFrom(pool: MealCatalogEntry[]): void {
    if (picked.length >= SUGGESTION_COUNT) return;
    const candidates = pool
      .filter((e) => !usedNames.has(e.name))
      .map((e) => ({ entry: e, score: scoreAgainstBudget(e, remaining) }))
      .sort((a, b) => a.score - b.score);
    const top = candidates.slice(0, 4);
    if (top.length === 0) return;
    const choice = top[Math.floor(Math.random() * top.length)].entry;
    usedNames.add(choice.name);
    picked.push(toSuggestion(choice));
  }

  for (const slot of slotsToTry) {
    pickFrom(MEAL_CATALOG.filter((e) => e.meal === slot));
  }

  // Top up from the full catalog if fewer than 2 unlogged slots produced
  // a pick (e.g. only one meal left to log today).
  pickFrom(MEAL_CATALOG);

  return picked;
}
