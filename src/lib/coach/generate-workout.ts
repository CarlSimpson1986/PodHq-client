import { EXERCISE_CATALOG, type CatalogExercise } from "@/lib/coach/exercise-catalog";
import type { CoachProfile, ExerciseHistoryEntry, RecentSessionSummary } from "@/lib/coach/coach-profile";
import type { Goal } from "@/lib/coach/types";

const EXERCISE_COUNT = 4;
const SETS_PER_EXERCISE = 3;

// Structured JSON out of this function (brief §9), computed by plain code
// rather than an LLM call — see the confirmed decision this session:
// deterministic logic for the numbers, LLM only for narration
// (src/lib/coach-bot.ts).
const REP_TARGET_BY_GOAL: Record<Goal, number> = {
  weight_loss: 12,
  fitness: 12,
  muscle_gain: 10,
  strength: 5,
};

export interface GeneratedExercise {
  key: string;
  name: string;
  muscleGroup: string;
  sets: number;
  repsTarget: number;
  weightTargetKg: number;
}

export interface GenerateWorkoutInput {
  profile: CoachProfile;
  history: ExerciseHistoryEntry[];
  lastSession: RecentSessionSummary | null;
}

export function generateWorkout(input: GenerateWorkoutInput): GeneratedExercise[] {
  const { profile, history, lastSession } = input;
  const eligible = selectExercises(profile, lastSession);
  const repsTarget = REP_TARGET_BY_GOAL[profile.goal];
  const historyByKey = new Map(history.map((h) => [h.exerciseKey, h]));

  return eligible.map((exercise) => ({
    key: exercise.key,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets: SETS_PER_EXERCISE,
    repsTarget,
    weightTargetKg: computeWeightKg(exercise, profile, historyByKey.get(exercise.key)),
  }));
}

function selectExercises(profile: CoachProfile, lastSession: RecentSessionSummary | null): CatalogExercise[] {
  const injuries = (profile.injuries ?? "").toLowerCase();
  const safe = EXERCISE_CATALOG.filter(
    (exercise) => !exercise.avoidIfInjury.some((keyword) => injuries.includes(keyword))
  );

  // Rotate away from muscle groups trained last session where possible —
  // only apply the rotation if it still leaves enough exercises to fill a
  // session; a small catalog or heavy injury filtering can otherwise
  // starve the list to nothing.
  const rotated = lastSession
    ? safe.filter((exercise) => !lastSession.muscleGroups.includes(exercise.muscleGroup))
    : safe;

  const pool = rotated.length >= EXERCISE_COUNT ? rotated : safe;
  return pool.slice(0, EXERCISE_COUNT);
}

function computeWeightKg(exercise: CatalogExercise, profile: CoachProfile, prior: ExerciseHistoryEntry | undefined): number {
  if (!prior) {
    return exercise.startingWeightKg[profile.experience_level];
  }
  return roundToNearestPlate(adjustForRpe(prior.lastWeightKg, prior.lastRpe));
}

// RPE 1-2 (Effortless/Easy) trends the weight up, 3 (Just Right) holds it,
// 4-5 (Hard/Killer) holds or trends it down — the rule added to
// MyFitPod-App-Brief.docx §9 this session. No RPE logged for the prior
// set (member skipped it) holds the weight rather than guessing.
function adjustForRpe(lastWeightKg: number, lastRpe: number | null): number {
  if (lastRpe === null) return lastWeightKg;
  if (lastRpe <= 2) return lastWeightKg * 1.05;
  if (lastRpe === 3) return lastWeightKg;
  return lastWeightKg * 0.95;
}

function roundToNearestPlate(kg: number, increment = 1.25): number {
  if (kg === 0) return 0;
  return Math.round(kg / increment) * increment;
}
