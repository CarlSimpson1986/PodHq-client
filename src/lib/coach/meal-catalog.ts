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
  // Real measurements (Carl, 2026-08-25: "needs cooking instructions and
  // measurements") — enough to actually shop for and cook this, not just
  // a macro readout.
  ingredients: string[];
  instructions: string[];
}

// Hand-written and reviewed, deliberately never LLM-generated — same
// principle as EXERCISE_CATALOG's safety tips (exercise-catalog.ts):
// nutrition numbers and instructions a member might actually act on
// don't get left to an LLM to improvise. Replaces a nearest-fit search
// over uk_food_composition (PHE's raw-ingredient reference data), which
// could only ever suggest single ingredients — Carl asked for real
// composed meals instead (2026-08-25: "high protein oats... chicken
// wraps"). Macros are realistic estimates for the stated portion, not
// lab-tested.
export const MEAL_CATALOG: MealCatalogEntry[] = [
  // Breakfast
  {
    meal: "breakfast",
    name: "High-protein oats",
    description: "Oats, whey protein, milk, banana",
    quantityG: 450,
    calories: 420,
    proteinG: 42,
    carbsG: 48,
    fatG: 8,
    ingredients: ["50g rolled oats", "250ml semi-skimmed milk", "1 scoop (30g) whey protein powder", "1 medium banana, sliced"],
    instructions: [
      "Add the oats and milk to a pan or microwave-safe bowl and cook for 2-3 minutes until thick.",
      "Stir in the protein powder until fully combined.",
      "Top with sliced banana and serve.",
    ],
  },
  {
    meal: "breakfast",
    name: "Greek yoghurt & berries with granola",
    description: "Greek yoghurt, mixed berries, granola",
    quantityG: 350,
    calories: 380,
    proteinG: 22,
    carbsG: 46,
    fatG: 10,
    ingredients: ["250g Greek yoghurt", "80g mixed berries", "40g granola"],
    instructions: ["Spoon the yoghurt into a bowl.", "Top with the berries and granola.", "Serve immediately."],
  },
  {
    meal: "breakfast",
    name: "Scrambled eggs on wholemeal toast",
    description: "3 eggs, 2 slices wholemeal toast, butter",
    quantityG: 300,
    calories: 400,
    proteinG: 28,
    carbsG: 32,
    fatG: 17,
    ingredients: ["3 medium eggs", "2 slices wholemeal bread", "5g butter", "Salt and pepper"],
    instructions: [
      "Whisk the eggs and season with salt and pepper.",
      "Melt the butter in a non-stick pan over low-medium heat and cook the eggs, stirring gently until just set.",
      "Toast the bread and serve the eggs on top.",
    ],
  },
  {
    meal: "breakfast",
    name: "Protein pancakes with berries",
    description: "Oat & protein pancakes, mixed berries, honey",
    quantityG: 300,
    calories: 380,
    proteinG: 30,
    carbsG: 40,
    fatG: 9,
    ingredients: ["60g oats (blended to a flour)", "1 scoop (30g) whey protein powder", "2 eggs", "100ml milk", "80g mixed berries"],
    instructions: [
      "Blend the oats, protein powder, eggs and milk into a smooth batter.",
      "Cook spoonfuls in a lightly oiled non-stick pan for 1-2 minutes per side until golden.",
      "Stack and top with the berries.",
    ],
  },
  {
    meal: "breakfast",
    name: "Smoked salmon & scrambled eggs",
    description: "Smoked salmon, 3 eggs",
    quantityG: 250,
    calories: 410,
    proteinG: 32,
    carbsG: 4,
    fatG: 29,
    ingredients: ["80g smoked salmon", "3 medium eggs", "Black pepper", "Squeeze of lemon"],
    instructions: [
      "Whisk the eggs and scramble gently in a non-stick pan over low heat.",
      "Serve topped with the smoked salmon.",
      "Season with black pepper and a squeeze of lemon.",
    ],
  },
  {
    meal: "breakfast",
    name: "Overnight oats with peanut butter",
    description: "Oats, milk, chia seeds, peanut butter",
    quantityG: 350,
    calories: 440,
    proteinG: 20,
    carbsG: 50,
    fatG: 16,
    ingredients: ["60g rolled oats", "200ml milk", "1 tbsp (15g) chia seeds", "1 tbsp (20g) peanut butter"],
    instructions: [
      "Combine the oats, milk and chia seeds in a jar or container.",
      "Stir in the peanut butter.",
      "Cover and refrigerate overnight; eat cold or warmed through.",
    ],
  },

  // Lunch
  {
    meal: "lunch",
    name: "Chicken wrap with salad",
    description: "Grilled chicken, tortilla wrap, salad, light mayo",
    quantityG: 320,
    calories: 480,
    proteinG: 38,
    carbsG: 46,
    fatG: 14,
    ingredients: ["150g grilled chicken breast, sliced", "1 large tortilla wrap", "Handful of mixed salad leaves", "1 tbsp (15g) light mayonnaise"],
    instructions: [
      "Warm the wrap slightly if you like.",
      "Layer the chicken, salad and mayonnaise down the centre.",
      "Fold in the sides and roll tightly.",
    ],
  },
  {
    meal: "lunch",
    name: "Chicken and rice bowl with veg",
    description: "Grilled chicken breast, basmati rice, mixed vegetables",
    quantityG: 450,
    calories: 560,
    proteinG: 45,
    carbsG: 60,
    fatG: 12,
    ingredients: ["180g chicken breast", "150g basmati rice (cooked weight)", "100g mixed vegetables"],
    instructions: [
      "Season and grill or pan-fry the chicken until cooked through, then slice.",
      "Cook the rice according to the pack instructions.",
      "Steam the vegetables and combine everything in a bowl.",
    ],
  },
  {
    meal: "lunch",
    name: "Tuna salad with wholemeal roll",
    description: "Tuna, mixed salad, wholemeal roll",
    quantityG: 350,
    calories: 430,
    proteinG: 34,
    carbsG: 42,
    fatG: 12,
    ingredients: ["1 can (145g) tuna in spring water, drained", "1 tbsp (15g) light mayonnaise", "Mixed salad leaves", "1 wholemeal roll"],
    instructions: ["Mix the drained tuna with the mayonnaise.", "Serve on a bed of salad with the roll on the side."],
  },
  {
    meal: "lunch",
    name: "Turkey and avocado sandwich",
    description: "Turkey breast, avocado, wholemeal bread",
    quantityG: 280,
    calories: 460,
    proteinG: 30,
    carbsG: 40,
    fatG: 19,
    ingredients: ["100g sliced turkey breast", "1/2 avocado, sliced", "2 slices wholemeal bread"],
    instructions: ["Toast the bread if you like.", "Layer the turkey and avocado between the slices.", "Cut in half and serve."],
  },
  {
    meal: "lunch",
    name: "Falafel and hummus wrap",
    description: "Falafel, hummus, salad, tortilla wrap (vegetarian)",
    quantityG: 320,
    calories: 500,
    proteinG: 18,
    carbsG: 58,
    fatG: 20,
    ingredients: ["6 falafel balls (approx. 120g)", "2 tbsp (40g) hummus", "1 large tortilla wrap", "Handful of mixed salad"],
    instructions: [
      "Warm the falafel through in an oven or pan.",
      "Spread the hummus over the wrap, then add the falafel and salad.",
      "Fold and roll tightly.",
    ],
  },
  {
    meal: "lunch",
    name: "Prawn and noodle salad",
    description: "Prawns, rice noodles, mixed vegetables, soy dressing",
    quantityG: 380,
    calories: 420,
    proteinG: 32,
    carbsG: 48,
    fatG: 8,
    ingredients: ["150g cooked king prawns", "100g rice noodles (cooked weight)", "Mixed vegetables (pepper, carrot, spring onion)", "1 tbsp soy sauce"],
    instructions: [
      "Cook the noodles according to the pack instructions and drain.",
      "Toss with the prawns, vegetables and soy sauce.",
      "Serve warm or cold.",
    ],
  },

  // Dinner
  {
    meal: "dinner",
    name: "Grilled salmon with sweet potato & broccoli",
    description: "Salmon fillet, roasted sweet potato, steamed broccoli",
    quantityG: 450,
    calories: 520,
    proteinG: 38,
    carbsG: 40,
    fatG: 22,
    ingredients: ["180g salmon fillet", "1 medium sweet potato (200g), cut into wedges", "100g broccoli"],
    instructions: [
      "Preheat the oven to 200°C and roast the sweet potato wedges for 25-30 minutes.",
      "Grill or bake the salmon for 12-15 minutes until cooked through.",
      "Steam the broccoli for the last 5 minutes and serve together.",
    ],
  },
  {
    meal: "dinner",
    name: "Chicken stir-fry with noodles",
    description: "Chicken breast, egg noodles, mixed vegetables, soy sauce",
    quantityG: 450,
    calories: 540,
    proteinG: 42,
    carbsG: 55,
    fatG: 14,
    ingredients: ["180g chicken breast, sliced", "100g egg noodles (cooked weight)", "Mixed stir-fry vegetables", "2 tbsp soy sauce"],
    instructions: [
      "Stir-fry the chicken in a hot wok or pan until cooked through.",
      "Add the vegetables and cook for 3-4 minutes.",
      "Add the cooked noodles and soy sauce, tossing to combine.",
    ],
  },
  {
    meal: "dinner",
    name: "Beef mince chilli with rice",
    description: "Lean beef mince, kidney beans, basmati rice",
    quantityG: 450,
    calories: 580,
    proteinG: 40,
    carbsG: 58,
    fatG: 18,
    ingredients: ["200g lean beef mince (5% fat)", "1/2 can (200g) kidney beans", "150g basmati rice (cooked weight)", "Chopped tomatoes, onion, chilli to taste"],
    instructions: [
      "Brown the mince in a pan with the onion and chilli.",
      "Add the chopped tomatoes and kidney beans, then simmer for 15-20 minutes.",
      "Serve over the cooked rice.",
    ],
  },
  {
    meal: "dinner",
    name: "Baked cod with new potatoes & greens",
    description: "Cod fillet, new potatoes, green beans",
    quantityG: 450,
    calories: 420,
    proteinG: 36,
    carbsG: 42,
    fatG: 8,
    ingredients: ["180g cod fillet", "200g new potatoes", "100g green beans"],
    instructions: [
      "Boil the new potatoes for 15-18 minutes until tender.",
      "Bake the cod at 200°C for 15 minutes until it flakes easily.",
      "Steam the green beans and serve together.",
    ],
  },
  {
    meal: "dinner",
    name: "Lentil and vegetable curry with rice",
    description: "Red lentils, mixed vegetables, basmati rice (vegetarian)",
    quantityG: 450,
    calories: 480,
    proteinG: 18,
    carbsG: 72,
    fatG: 10,
    ingredients: ["150g red lentils", "Mixed vegetables (onion, carrot, spinach)", "1 can chopped tomatoes", "Curry spices to taste", "150g basmati rice (cooked weight)"],
    instructions: [
      "Simmer the lentils with the chopped tomatoes, spices and vegetables for 20-25 minutes until soft.",
      "Cook the rice according to the pack instructions.",
      "Serve the curry over the rice.",
    ],
  },
  {
    meal: "dinner",
    name: "Turkey meatballs with wholewheat pasta",
    description: "Turkey meatballs, tomato sauce, wholewheat pasta",
    quantityG: 450,
    calories: 550,
    proteinG: 40,
    carbsG: 60,
    fatG: 14,
    ingredients: ["200g turkey mince", "100g wholewheat pasta (dry weight)", "Passata + herbs, to make a tomato sauce"],
    instructions: [
      "Shape the turkey mince into meatballs and bake or pan-fry until cooked through.",
      "Cook the pasta according to the pack instructions.",
      "Simmer the meatballs in the tomato sauce for 5-10 minutes and serve over the pasta.",
    ],
  },

  // Snacks
  {
    meal: "snacks",
    name: "Protein shake with banana",
    description: "Whey protein, milk, banana",
    quantityG: 350,
    calories: 240,
    proteinG: 30,
    carbsG: 24,
    fatG: 3,
    ingredients: ["1 scoop (30g) whey protein powder", "250ml milk", "1 medium banana"],
    instructions: ["Add all ingredients to a blender.", "Blend until smooth and serve."],
  },
  {
    meal: "snacks",
    name: "Greek yoghurt with honey",
    description: "Greek yoghurt, honey",
    quantityG: 200,
    calories: 180,
    proteinG: 16,
    carbsG: 20,
    fatG: 3,
    ingredients: ["180g Greek yoghurt", "1 tbsp (20g) honey"],
    instructions: ["Spoon the yoghurt into a bowl.", "Drizzle over the honey and serve."],
  },
  {
    meal: "snacks",
    name: "Cottage cheese & oatcakes",
    description: "Cottage cheese, oatcakes",
    quantityG: 150,
    calories: 200,
    proteinG: 16,
    carbsG: 18,
    fatG: 7,
    ingredients: ["100g cottage cheese", "3 oatcakes"],
    instructions: ["Serve the cottage cheese with the oatcakes on the side."],
  },
  {
    meal: "snacks",
    name: "Rice cakes with peanut butter",
    description: "2 rice cakes, peanut butter",
    quantityG: 60,
    calories: 220,
    proteinG: 7,
    carbsG: 22,
    fatG: 12,
    ingredients: ["2 rice cakes", "1 tbsp (20g) peanut butter"],
    instructions: ["Spread the peanut butter over the rice cakes and serve."],
  },
  {
    meal: "snacks",
    name: "Boiled eggs",
    description: "2 boiled eggs",
    quantityG: 100,
    calories: 140,
    proteinG: 12,
    carbsG: 1,
    fatG: 10,
    ingredients: ["2 medium eggs"],
    instructions: ["Boil the eggs for 7-8 minutes for a firm yolk (5-6 minutes for soft).", "Cool briefly under cold water, then peel and serve."],
  },
  {
    meal: "snacks",
    name: "Apple with almond butter",
    description: "1 apple, almond butter",
    quantityG: 180,
    calories: 210,
    proteinG: 5,
    carbsG: 24,
    fatG: 11,
    ingredients: ["1 medium apple, sliced", "1 tbsp (20g) almond butter"],
    instructions: ["Slice the apple.", "Serve with the almond butter for dipping."],
  },
];
