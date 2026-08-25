import type { Meal } from "@/lib/coach/types";

export interface MealCatalogEntry {
  meal: Meal;
  name: string;
  // Short ingredient summary, shown under the meal name in the
  // suggestion card — what it actually is, not a recipe.
  description: string;
  // Typical serving weight, and that serving's total macros — a
  // composed meal, not a per-100g ingredient value (see
  // meal-suggestions.ts's toSuggestion for how this converts to the
  // per-100g shape POST /api/member/nutrition/log expects).
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Hand-written and reviewed, deliberately never LLM-generated — same
// principle as EXERCISE_CATALOG's safety tips (exercise-catalog.ts):
// nutrition numbers a member might actually act on don't get left to an
// LLM to improvise. Replaces a nearest-fit search over
// uk_food_composition (PHE's raw-ingredient reference data), which could
// only ever suggest single ingredients — Carl asked for real composed
// meals instead (2026-08-25: "high protein oats... chicken wraps").
// Macros are realistic estimates for the stated portion, not lab-tested.
export const MEAL_CATALOG: MealCatalogEntry[] = [
  // Breakfast
  { meal: "breakfast", name: "High-protein oats", description: "Oats, whey protein, milk, banana", quantityG: 450, calories: 420, proteinG: 42, carbsG: 48, fatG: 8 },
  { meal: "breakfast", name: "Greek yoghurt & berries with granola", description: "Greek yoghurt, mixed berries, granola", quantityG: 350, calories: 380, proteinG: 22, carbsG: 46, fatG: 10 },
  { meal: "breakfast", name: "Scrambled eggs on wholemeal toast", description: "3 eggs, 2 slices wholemeal toast, butter", quantityG: 300, calories: 400, proteinG: 28, carbsG: 32, fatG: 17 },
  { meal: "breakfast", name: "Protein pancakes with berries", description: "Oat & protein pancakes, mixed berries, honey", quantityG: 300, calories: 380, proteinG: 30, carbsG: 40, fatG: 9 },
  { meal: "breakfast", name: "Smoked salmon & scrambled eggs", description: "Smoked salmon, 3 eggs", quantityG: 250, calories: 410, proteinG: 32, carbsG: 4, fatG: 29 },
  { meal: "breakfast", name: "Overnight oats with peanut butter", description: "Oats, milk, chia seeds, peanut butter", quantityG: 350, calories: 440, proteinG: 20, carbsG: 50, fatG: 16 },

  // Lunch
  { meal: "lunch", name: "Chicken wrap with salad", description: "Grilled chicken, tortilla wrap, salad, light mayo", quantityG: 320, calories: 480, proteinG: 38, carbsG: 46, fatG: 14 },
  { meal: "lunch", name: "Chicken and rice bowl with veg", description: "Grilled chicken breast, basmati rice, mixed vegetables", quantityG: 450, calories: 560, proteinG: 45, carbsG: 60, fatG: 12 },
  { meal: "lunch", name: "Tuna salad with wholemeal roll", description: "Tuna, mixed salad, wholemeal roll", quantityG: 350, calories: 430, proteinG: 34, carbsG: 42, fatG: 12 },
  { meal: "lunch", name: "Turkey and avocado sandwich", description: "Turkey breast, avocado, wholemeal bread", quantityG: 280, calories: 460, proteinG: 30, carbsG: 40, fatG: 19 },
  { meal: "lunch", name: "Falafel and hummus wrap", description: "Falafel, hummus, salad, tortilla wrap (vegetarian)", quantityG: 320, calories: 500, proteinG: 18, carbsG: 58, fatG: 20 },
  { meal: "lunch", name: "Prawn and noodle salad", description: "Prawns, rice noodles, mixed vegetables, soy dressing", quantityG: 380, calories: 420, proteinG: 32, carbsG: 48, fatG: 8 },

  // Dinner
  { meal: "dinner", name: "Grilled salmon with sweet potato & broccoli", description: "Salmon fillet, roasted sweet potato, steamed broccoli", quantityG: 450, calories: 520, proteinG: 38, carbsG: 40, fatG: 22 },
  { meal: "dinner", name: "Chicken stir-fry with noodles", description: "Chicken breast, egg noodles, mixed vegetables, soy sauce", quantityG: 450, calories: 540, proteinG: 42, carbsG: 55, fatG: 14 },
  { meal: "dinner", name: "Beef mince chilli with rice", description: "Lean beef mince, kidney beans, basmati rice", quantityG: 450, calories: 580, proteinG: 40, carbsG: 58, fatG: 18 },
  { meal: "dinner", name: "Baked cod with new potatoes & greens", description: "Cod fillet, new potatoes, green beans", quantityG: 450, calories: 420, proteinG: 36, carbsG: 42, fatG: 8 },
  { meal: "dinner", name: "Lentil and vegetable curry with rice", description: "Red lentils, mixed vegetables, basmati rice (vegetarian)", quantityG: 450, calories: 480, proteinG: 18, carbsG: 72, fatG: 10 },
  { meal: "dinner", name: "Turkey meatballs with wholewheat pasta", description: "Turkey meatballs, tomato sauce, wholewheat pasta", quantityG: 450, calories: 550, proteinG: 40, carbsG: 60, fatG: 14 },

  // Snacks
  { meal: "snacks", name: "Protein shake with banana", description: "Whey protein, milk, banana", quantityG: 350, calories: 240, proteinG: 30, carbsG: 24, fatG: 3 },
  { meal: "snacks", name: "Greek yoghurt with honey", description: "Greek yoghurt, honey", quantityG: 200, calories: 180, proteinG: 16, carbsG: 20, fatG: 3 },
  { meal: "snacks", name: "Cottage cheese & oatcakes", description: "Cottage cheese, oatcakes", quantityG: 150, calories: 200, proteinG: 16, carbsG: 18, fatG: 7 },
  { meal: "snacks", name: "Rice cakes with peanut butter", description: "2 rice cakes, peanut butter", quantityG: 60, calories: 220, proteinG: 7, carbsG: 22, fatG: 12 },
  { meal: "snacks", name: "Boiled eggs", description: "2 boiled eggs", quantityG: 100, calories: 140, proteinG: 12, carbsG: 1, fatG: 10 },
  { meal: "snacks", name: "Apple with almond butter", description: "1 apple, almond butter", quantityG: 180, calories: 210, proteinG: 5, carbsG: 24, fatG: 11 },
];
