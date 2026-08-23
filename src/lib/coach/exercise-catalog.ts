import type { ExperienceLevel } from "@/lib/coach/types";

export type MuscleGroup = "chest" | "back" | "shoulders" | "legs" | "arms" | "core" | "full_body";

export interface CatalogExercise {
  key: string;
  name: string;
  muscleGroup: MuscleGroup;
  // Keyword-matched (lowercase substring) against coach_profiles.injuries
  // free text — an exercise is excluded from generation if any of these
  // keywords appear in the member's stated injuries.
  avoidIfInjury: string[];
  // Conservative first-time weight, before any real RPE feedback exists
  // for this exercise. 0 = bodyweight/no added load.
  startingWeightKg: Record<ExperienceLevel, number>;
}

// Placeholder catalog — a small, generic set matching common private-pod
// gym equipment (machines, dumbbells, kettlebells, bodyweight), NOT
// pulled from Hove's actual equipment inventory (pod_resources has no
// equipment field to draw from yet). Adjust this list to what Hove's pod
// actually has before this goes live to real members.
export const EXERCISE_CATALOG: CatalogExercise[] = [
  {
    key: "goblet_squat",
    name: "Goblet Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 8, intermediate: 16, advanced: 24 },
  },
  {
    key: "seated_chest_press",
    name: "Seated Chest Press",
    muscleGroup: "chest",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
  },
  {
    key: "lat_pulldown",
    name: "Lat Pulldown",
    muscleGroup: "back",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
  },
  {
    key: "dumbbell_shoulder_press",
    name: "Dumbbell Shoulder Press",
    muscleGroup: "shoulders",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 6, intermediate: 10, advanced: 16 },
  },
  {
    key: "romanian_deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "legs",
    avoidIfInjury: ["back", "knee"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 40 },
  },
  {
    key: "seated_row",
    name: "Seated Row",
    muscleGroup: "back",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 15, intermediate: 30, advanced: 45 },
  },
  {
    key: "dumbbell_bicep_curl",
    name: "Dumbbell Bicep Curl",
    muscleGroup: "arms",
    avoidIfInjury: [],
    startingWeightKg: { beginner: 4, intermediate: 8, advanced: 12 },
  },
  {
    key: "tricep_pushdown",
    name: "Tricep Pushdown",
    muscleGroup: "arms",
    avoidIfInjury: ["shoulders"],
    startingWeightKg: { beginner: 10, intermediate: 20, advanced: 30 },
  },
  {
    key: "plank",
    name: "Plank",
    muscleGroup: "core",
    avoidIfInjury: ["back"],
    startingWeightKg: { beginner: 0, intermediate: 0, advanced: 0 },
  },
  {
    key: "kettlebell_swing",
    name: "Kettlebell Swing",
    muscleGroup: "full_body",
    avoidIfInjury: ["back", "knee"],
    startingWeightKg: { beginner: 8, intermediate: 16, advanced: 24 },
  },
  {
    key: "bodyweight_squat",
    name: "Bodyweight Squat",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 0, intermediate: 0, advanced: 0 },
  },
  {
    key: "leg_press",
    name: "Leg Press",
    muscleGroup: "legs",
    avoidIfInjury: ["knee"],
    startingWeightKg: { beginner: 20, intermediate: 50, advanced: 90 },
  },
];
