import type { HabitType } from "@/lib/coach/types";

export interface RecommendedHabit {
  name: string;
  habitType: HabitType;
  // Only meaningful for habitType "counted".
  targetCount?: number;
}

// A starting list of common habits to offer alongside "add your own" —
// content, not config, same "list lives in code, Carl's the only one
// who'd manage it" convention as EXERCISE_CATALOG. Deliberately small and
// generic rather than goal-tailored (e.g. no separate weight-loss vs.
// muscle-gain lists) — a member can always add a custom habit for
// anything more specific.
export const RECOMMENDED_HABITS: RecommendedHabit[] = [
  { name: "Drink water", habitType: "counted", targetCount: 8 },
  { name: "Hit protein target", habitType: "checkbox" },
  { name: "Get 7+ hours sleep", habitType: "checkbox" },
  { name: "Eat a portion of fruit or veg", habitType: "counted", targetCount: 5 },
  { name: "Stretch or mobility work", habitType: "checkbox" },
  { name: "Walk 8,000+ steps", habitType: "checkbox" },
  { name: "No alcohol", habitType: "checkbox" },
];
