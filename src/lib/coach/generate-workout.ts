import { EXERCISE_CATALOG, type CatalogExercise } from "@/lib/coach/exercise-catalog";
import type { CoachProfile, ExerciseHistoryEntry, RecentSessionSummary } from "@/lib/coach/coach-profile";
import {
  REP_TARGET_BY_BLOCK_PHASE,
  DELOAD_REP_TARGET,
  PHASE_DURATION_WEEKS,
  DELOAD_WEIGHT_MULTIPLIER,
  DELOAD_SETS_PER_EXERCISE,
  type Goal,
  type BlockType,
  type EquipmentType,
} from "@/lib/coach/types";
import { londonMidnight } from "@/lib/london-time";

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
  // Optional (Stage 12) — absent means today's exact goal-based behavior,
  // byte-identical to before blocks existed. startedAt drives which
  // 4-week rep-range phase is active (see REP_TARGET_BY_BLOCK_PHASE);
  // required whenever activeBlock is given since every real caller
  // (resolveActiveBlock in workout-session.ts) always has it.
  activeBlock?: { blockType: BlockType; startedAt: string };
  // Optional, same "absent = today's exact behavior" idiom as
  // activeBlock — undefined or [] both mean unrestricted (the full
  // catalog, no equipment filtering), which is what every gym gets until
  // its pod_resources row is explicitly configured (see
  // getOrCreateWorkoutSession in workout-session.ts).
  availableEquipment?: EquipmentType[];
  // Injectable for deterministic phase-boundary testing; defaults to the
  // real current time in production.
  now?: Date;
}

// Which of the 3 rep-range phases (0-indexed) startedAt falls into,
// relative to now — same londonMidnight-based day-bucketing convention
// as training-block-state.ts's own week-boundary math, for the same
// reason (a naive UTC/local diff can land a phase change on the wrong
// day around the BST transition). Clamped to the last phase past week
// 12 rather than extrapolating a 4th phase — a block that's run past its
// nominal length (transition not yet confirmed) just holds at its
// hardest/lightest rep target, not something undefined.
export function blockPhaseIndex(startedAt: string, now: Date): 0 | 1 | 2 {
  const startMidnight = londonMidnight(new Date(startedAt)).getTime();
  const nowMidnight = londonMidnight(now).getTime();
  const weeksElapsed = Math.floor((nowMidnight - startMidnight) / (7 * 24 * 60 * 60 * 1000));
  if (weeksElapsed < PHASE_DURATION_WEEKS) return 0;
  if (weeksElapsed < PHASE_DURATION_WEEKS * 2) return 1;
  return 2;
}

function repsTargetForBlock(activeBlock: { blockType: BlockType; startedAt: string } | undefined, goal: Goal, now: Date): number {
  if (!activeBlock) return REP_TARGET_BY_GOAL[goal];
  if (activeBlock.blockType === "deload") return DELOAD_REP_TARGET;
  const phase = blockPhaseIndex(activeBlock.startedAt, now);
  return REP_TARGET_BY_BLOCK_PHASE[activeBlock.blockType][phase];
}

export function generateWorkout(input: GenerateWorkoutInput): GeneratedExercise[] {
  const { profile, history, lastSession, activeBlock, availableEquipment, now = new Date() } = input;
  const eligible = selectExercises(profile, lastSession, activeBlock ?? null, availableEquipment);
  const repsTarget = repsTargetForBlock(activeBlock, profile.goal, now);
  const sets = activeBlock?.blockType === "deload" ? DELOAD_SETS_PER_EXERCISE : SETS_PER_EXERCISE;
  const historyByKey = new Map(history.map((h) => [h.exerciseKey, h]));

  return eligible.map((exercise) => ({
    key: exercise.key,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets,
    repsTarget,
    weightTargetKg: computeWeightKgForBlock(exercise, profile, historyByKey.get(exercise.key), activeBlock),
  }));
}

// Extracted from selectExercises's own filter so the exercise-swap flow
// (workout-session.ts) can validate a member-chosen replacement against
// the exact same injury exclusion generation itself uses, rather than a
// second copy of this logic that could drift.
export function getInjuryExcludedKeys(injuries: string | null): string[] {
  const lower = (injuries ?? "").toLowerCase();
  return EXERCISE_CATALOG.filter((exercise) => exercise.avoidIfInjury.some((keyword) => lower.includes(keyword))).map(
    (exercise) => exercise.key
  );
}

// Mirrors getInjuryExcludedKeys above — extracted the same way so the
// exercise-swap flow (workout-session.ts's swapExercise) can validate a
// member-chosen replacement against the exact same equipment gate
// generation itself uses. Undefined/empty availableEquipment means
// unrestricted (an unconfigured pod_resources row) — nothing excluded.
export function getEquipmentExcludedKeys(availableEquipment: EquipmentType[] | undefined): string[] {
  if (!availableEquipment || availableEquipment.length === 0) return [];
  const available = new Set(availableEquipment);
  return EXERCISE_CATALOG.filter(
    (exercise) => exercise.requiredEquipment !== null && !available.has(exercise.requiredEquipment)
  ).map((exercise) => exercise.key);
}

function selectExercises(
  profile: CoachProfile,
  lastSession: RecentSessionSummary | null,
  activeBlock: { blockType: BlockType } | null,
  availableEquipment: EquipmentType[] | undefined
): CatalogExercise[] {
  const excludedKeys = new Set([
    ...getInjuryExcludedKeys(profile.injuries),
    ...getEquipmentExcludedKeys(availableEquipment),
  ]);
  const safe = EXERCISE_CATALOG.filter((exercise) => !excludedKeys.has(exercise.key));

  // A Strength block softly prefers compound lifts (heavier loads at
  // lower reps are a real place a poorly-chosen isolation exercise would
  // be a program-quality issue) — but only ever narrows *within* the
  // already injury-safe set, and falls back to the full safe set exactly
  // the way the muscle-group rotation below already does, rather than
  // ever re-including something injury-excluded or compounding two
  // narrowing filters into an over-constrained pool.
  const blockPreferred = activeBlock?.blockType === "strength" ? safe.filter((exercise) => exercise.isCompound) : safe;
  const blockPool = blockPreferred.length >= EXERCISE_COUNT ? blockPreferred : safe;

  // Rotate away from muscle groups trained last session where possible —
  // only apply the rotation if it still leaves enough exercises to fill a
  // session; a small catalog or heavy injury filtering can otherwise
  // starve the list to nothing.
  const rotated = lastSession
    ? blockPool.filter((exercise) => !lastSession.muscleGroups.includes(exercise.muscleGroup))
    : blockPool;

  const pool = rotated.length >= EXERCISE_COUNT ? rotated : blockPool;
  return pool.slice(0, EXERCISE_COUNT);
}

function computeWeightKg(exercise: CatalogExercise, profile: CoachProfile, prior: ExerciseHistoryEntry | undefined): number {
  if (!prior) {
    return exercise.startingWeightKg[profile.experience_level];
  }
  return roundToNearestPlate(adjustForRpe(prior.lastWeightKg, prior.lastRpe));
}

// Blocks only ever change which repsTarget/exercise pool feed into the
// existing RPE-driven logic above, plus (deload only) a fixed post-hoc
// discount — computeWeightKg/adjustForRpe/roundToNearestPlate themselves
// stay byte-identical, the actual weight-picking mechanism this app's
// safety review has already covered is untouched by which block is active.
// Exported for reuse by the exercise-swap flow (workout-session.ts),
// which needs to pick a starting weight for a newly-swapped-in exercise
// via the exact same RPE-history/deload-discount logic as generation.
export function computeWeightKgForBlock(
  exercise: CatalogExercise,
  profile: CoachProfile,
  prior: ExerciseHistoryEntry | undefined,
  activeBlock: { blockType: BlockType } | undefined
): number {
  const raw = computeWeightKg(exercise, profile, prior);
  if (activeBlock?.blockType === "deload") {
    return roundToNearestPlate(raw * DELOAD_WEIGHT_MULTIPLIER);
  }
  return raw;
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
