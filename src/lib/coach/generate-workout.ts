import { EXERCISE_CATALOG, type CatalogExercise, type MuscleGroup } from "@/lib/coach/exercise-catalog";
import type { CoachProfile, ExerciseHistoryEntry, RecentSessionSummary } from "@/lib/coach/coach-profile";
import {
  REP_TARGET_BY_BLOCK_PHASE,
  DELOAD_REP_TARGET,
  PHASE_DURATION_WEEKS,
  DELOAD_WEIGHT_MULTIPLIER,
  DELOAD_SETS_PER_EXERCISE,
  SECONDS_PER_REP,
  SESSION_SECONDS,
  REST_SECONDS_BY_BLOCK,
  RPE_ADJUSTMENT_PERCENT_BY_EXPERIENCE,
  type Goal,
  type BlockType,
  type EquipmentType,
  type ExperienceLevel,
} from "@/lib/coach/types";
import { londonMidnight } from "@/lib/london-time";

const MIN_EXERCISE_COUNT = 4;
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
  // null the very first time a member does this exercise — no default
  // is guessed at all (see computeWeightKg below); the member logs
  // their own real weight, and RPE-based progression takes over from
  // their second time on, same as it always has for every session
  // after the first.
  weightTargetKg: number | null;
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

// Exported for instantiateTemplate below — a template's weight/reps must
// be recomputed live every time it's used (RPE history and the active
// phase both change week to week), never baked in once at template
// creation, so this needs to be callable from outside this file too.
export function repsTargetForBlock(activeBlock: { blockType: BlockType; startedAt: string } | undefined, goal: Goal, now: Date): number {
  if (!activeBlock) return REP_TARGET_BY_GOAL[goal];
  if (activeBlock.blockType === "deload") return DELOAD_REP_TARGET;
  const phase = blockPhaseIndex(activeBlock.startedAt, now);
  return REP_TARGET_BY_BLOCK_PHASE[activeBlock.blockType][phase];
}

// How many exercises fit in a 50-minute session for this block/phase's
// rep target (2026-08-29, Carl's call — see types.ts's SECONDS_PER_REP/
// SESSION_SECONDS/REST_SECONDS_BY_BLOCK for the full reasoning). Blended
// 50/50 compound:isolation estimate rather than a real bin-packing
// algorithm — the actual exercise pool (selectExercises/
// generateWorkoutTemplateSet) already naturally mixes compound and
// isolation exercises across its muscle-group rotation, so this only
// needs to answer "how many slots", not "which type goes where". Floored
// at MIN_EXERCISE_COUNT (4) — the original fixed count — so this can only
// ever add exercises, never regress a session below what already shipped
// and was safety-reviewed.
export function computeExerciseCount(activeBlock: { blockType: BlockType; startedAt: string } | undefined, goal: Goal, now: Date): number {
  const blockType = activeBlock?.blockType ?? "hypertrophy";
  const sets = blockType === "deload" ? DELOAD_SETS_PER_EXERCISE : SETS_PER_EXERCISE;
  const reps = repsTargetForBlock(activeBlock, goal, now);
  const setSeconds = reps * SECONDS_PER_REP;
  const rest = REST_SECONDS_BY_BLOCK[blockType];
  const compoundSeconds = sets * (setSeconds + rest.compound);
  const isolationSeconds = sets * (setSeconds + rest.isolation);
  const blendedSeconds = (compoundSeconds + isolationSeconds) / 2;
  return Math.max(MIN_EXERCISE_COUNT, Math.floor(SESSION_SECONDS / blendedSeconds));
}

export function generateWorkout(input: GenerateWorkoutInput): GeneratedExercise[] {
  const { profile, history, lastSession, activeBlock, availableEquipment, now = new Date() } = input;
  const exerciseCount = computeExerciseCount(activeBlock, profile.goal, now);
  const eligible = selectExercises(profile, lastSession, activeBlock ?? null, availableEquipment, exerciseCount);
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
//
// Singular/plural fix (2026-08-30) — every avoidIfInjury keyword except
// "shoulders" is stored in a form a natural plural still contains as a
// substring ("knee" ⊂ "knees"), so the raw substring check worked for
// them by accident. "shoulders" is the one keyword stored plural, so a
// member typing the far more natural singular ("shoulder injury", "bad
// shoulder") matched nothing and got zero exclusions — a real member
// reporting a real injury, silently ignored. Stripping a trailing "s"
// before matching makes the check singular/plural-insensitive for every
// regularly-pluralised keyword, not just a special case for this one.
function singularize(keyword: string): string {
  return keyword.endsWith("s") ? keyword.slice(0, -1) : keyword;
}

// Irregular plurals (2026-08-30, caught while expanding the keyword list to
// full body parts) — "calf" pluralises to "calves", not "calfs", so the
// same substring bug "shoulders" had would silently recur for the far more
// natural "my calves hurt" phrasing: singularize() only strips a trailing
// "s", which doesn't touch this case at all. Rather than special-case the
// match function again, list each keyword's irregular plural (if it has
// one) here — every other current/future keyword stays covered by
// singularize() alone.
const IRREGULAR_INJURY_PLURALS: Record<string, string> = {
  calf: "calves",
};

function injuryKeywordVariants(keyword: string): string[] {
  const variants = [singularize(keyword)];
  const irregular = IRREGULAR_INJURY_PLURALS[keyword];
  if (irregular) variants.push(irregular);
  return variants;
}

export function getInjuryExcludedKeys(injuries: string | null): string[] {
  const lower = (injuries ?? "").toLowerCase();
  return EXERCISE_CATALOG.filter((exercise) =>
    exercise.avoidIfInjury.some((keyword) => injuryKeywordVariants(keyword).some((variant) => lower.includes(variant)))
  ).map((exercise) => exercise.key);
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
  availableEquipment: EquipmentType[] | undefined,
  exerciseCount: number
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
  const blockPool = blockPreferred.length >= exerciseCount ? blockPreferred : safe;

  // Rotate away from muscle groups trained last session where possible —
  // only apply the rotation if it still leaves enough exercises to fill a
  // session; a small catalog or heavy injury filtering can otherwise
  // starve the list to nothing.
  const rotated = lastSession
    ? blockPool.filter((exercise) => !lastSession.muscleGroups.includes(exercise.muscleGroup))
    : blockPool;

  const pool = rotated.length >= exerciseCount ? rotated : blockPool;
  return pool.slice(0, exerciseCount);
}

// null the very first time (see GeneratedExercise's own comment) — no
// per-experience-level *starting* weight is guessed at all, deliberately,
// since even a "conservative" guess is still the app guessing on a
// beginner's behalf rather than the beginner logging what they actually
// used. experience_level only affects the RATE of change from the second
// time on (adjustForRpe below), never the first-time blank.
function computeWeightKg(exercise: CatalogExercise, profile: CoachProfile, prior: ExerciseHistoryEntry | undefined): number | null {
  if (!prior) {
    return null;
  }
  return roundToNearestPlate(adjustForRpe(prior.lastWeightKg, prior.lastRpe, profile.experience_level));
}

// Blocks only ever change which repsTarget/exercise pool feed into the
// existing RPE-driven logic above, plus (deload only) a fixed post-hoc
// discount — computeWeightKg/adjustForRpe/roundToNearestPlate themselves
// stay byte-identical, the actual weight-picking mechanism this app's
// safety review has already covered is untouched by which block is active.
// Exported for reuse by the exercise-swap flow (workout-session.ts),
// which needs to pick a starting weight for a newly-swapped-in exercise
// via the exact same RPE-history/deload-discount logic as generation.
// A still-null raw weight (no history for this exercise yet) stays null
// — there's nothing for a deload discount to apply to.
export function computeWeightKgForBlock(
  exercise: CatalogExercise,
  profile: CoachProfile,
  prior: ExerciseHistoryEntry | undefined,
  activeBlock: { blockType: BlockType } | undefined
): number | null {
  const raw = computeWeightKg(exercise, profile, prior);
  if (raw === null) return null;
  if (activeBlock?.blockType === "deload") {
    return roundToNearestPlate(raw * DELOAD_WEIGHT_MULTIPLIER);
  }
  return raw;
}

// RPE 1-2 (Effortless/Easy) trends the weight up, 3 (Just Right) holds it,
// 4-5 (Hard/Killer) holds or trends it down — the rule added to
// MyFitPod-App-Brief.docx §9 this session. No RPE logged for the prior
// set (member skipped it) holds the weight rather than guessing. The
// magnitude of that up/down move is scaled by experience_level
// (2026-08-30, see RPE_ADJUSTMENT_PERCENT_BY_EXPERIENCE's own comment in
// types.ts for why beginners move faster, not slower) — intermediate's
// 5% is unchanged from this rule's original single flat value.
function adjustForRpe(lastWeightKg: number, lastRpe: number | null, experienceLevel: ExperienceLevel): number {
  if (lastRpe === null) return lastWeightKg;
  const delta = RPE_ADJUSTMENT_PERCENT_BY_EXPERIENCE[experienceLevel];
  if (lastRpe <= 2) return lastWeightKg * (1 + delta);
  if (lastRpe === 3) return lastWeightKg;
  return lastWeightKg * (1 - delta);
}

function roundToNearestPlate(kg: number, increment = 1.25): number {
  if (kg === 0) return 0;
  return Math.round(kg / increment) * increment;
}

// Persistent Hypertrophy A/B/C rotation (2026-08-27) — Carl: pod members
// realistically train up to ~3x/week, so the default should stay
// full-body per session, but the exercise *selection* should repeat as
// a consistent "Workout A/B/C" for the length of a training-block phase
// instead of being picked fresh every session the way generateWorkout()
// above always has. See workout-templates.ts for where these get
// persisted/rotated; this file only ever picks *which* exercises go in
// each template — weight/reps are deliberately never computed here (see
// instantiateTemplate below), since RPE history and the active phase
// both keep changing for as long as a template stays in rotation.
//
// Each template covers however many exercises computeExerciseCount says
// fit in 50 minutes for the active phase (2026-08-29 — previously a flat
// 4, matching EXERCISE_COUNT). Legs leads every letter (the largest
// muscle group, and every full-body program trains it every session,
// 2026-08-27's original reasoning) and reappears once more near the end
// of a longer session rather than a fixed slot count; the middle slots
// are the original 3-group picks per letter so the *set* of three
// templates still collectively balances the week the same way it always
// has, just with more depth per letter when the time budget allows it.
// 8 entries covers computeExerciseCount's realistic range (4-9); a count
// past that just gets what the list has (see the .slice below). Same
// "invented but defensible, not literature-perfect" category as this
// file's other program-design constants — order is Carl's to refine.
const TEMPLATE_LETTERS = ["A", "B", "C"] as const;
export type TemplateLetter = (typeof TEMPLATE_LETTERS)[number];

const TEMPLATE_MUSCLE_GROUP_PRIORITY: Record<TemplateLetter, MuscleGroup[]> = {
  A: ["legs", "chest", "back", "core", "shoulders", "arms", "legs", "core"],
  B: ["legs", "shoulders", "back", "arms", "chest", "core", "legs", "shoulders"],
  C: ["legs", "chest", "shoulders", "core", "back", "arms", "legs", "chest"],
};

// Squat/bench/deadlift split for Strength blocks specifically (2026-08-29,
// Carl's call) — replaces the muscle-group rotation above for Strength
// only; Hypertrophy/Deload are untouched. Adapted from Sebastian Oreb's
// real, published coaching approach (strengthsystem.com, Melbourne
// Personal Trainers' Wolf's Den interview, Men's Health AU — researched
// 2026-08-29, not invented): one main compound lift per session,
// accessories chosen for *structural balance* around that lift's actual
// weak points (posterior chain / unilateral stability for squat; upper
// back / external rotators / triceps for bench; posterior chain / lats /
// bracing for deadlift) rather than generic per-muscle-group volume.
// Deliberately does NOT follow his real competition-phase intensity
// (near-max unsupervised singles/doubles) — this app's existing 3-rep
// floor (REP_TARGET_BY_BLOCK_PHASE.strength, computeWeightKgForBlock)
// stays exactly as it was; these are unstaffed pods with no spotter (see
// generateWorkout's own comment on why strength never goes below 3 reps).
// Fixed key lists, not muscle-group filters — this is deliberate exercise
// curation, so an excluded pick is skipped (see selectStrengthFocusPlan
// below), never swapped for an unrelated same-muscle-group substitute.
const STRENGTH_FOCUS_PLAN: Record<TemplateLetter, { label: string; keys: string[] }> = {
  A: {
    label: "Squat Day",
    // leg_extension/lying_leg_curl — the gym's 2-in-1 leg extension/curl
    // machine (Carl, 2026-08-29): direct quad + hamstring isolation,
    // exactly the "weak point" accessory pairing Oreb's structural-balance
    // approach calls for around a squat.
    keys: [
      "barbell_squat",
      "leg_extension",
      "lying_leg_curl",
      "barbell_hip_thrust",
      "plank",
      "barbell_front_squat",
      "dumbbell_bulgarian_split_squat",
      "romanian_deadlift",
    ],
  },
  B: {
    label: "Bench Day",
    keys: ["barbell_bench_press", "barbell_overhead_press", "barbell_bent_over_row", "cable_face_pull", "tricep_pushdown", "lat_pulldown", "seated_row"],
  },
  C: {
    label: "Deadlift Day",
    // lying_leg_curl here too — hamstrings are one of the biggest direct
    // contributors to the deadlift, same 2-in-1 machine.
    keys: ["barbell_deadlift", "lying_leg_curl", "barbell_bent_over_row", "barbell_hip_thrust", "plank", "lat_pulldown", "romanian_deadlift", "dumbbell_russian_twist"],
  },
};

// "Squat Day"/"Bench Day"/"Deadlift Day" for a Strength-block template's
// letter, null for any other block type — pure lookup, safe to call from
// client components (no server-only import) so /training's preview and
// any future workout-screen label can both use it without threading the
// full plan through props.
export function getStrengthFocusLabel(letter: TemplateLetter, blockType: BlockType | undefined): string | null {
  return blockType === "strength" ? STRENGTH_FOCUS_PLAN[letter].label : null;
}

// Injury/equipment-filtered candidates only (safe) — an excluded key
// (main lift or accessory) is skipped outright rather than backfilled
// with something else, same "never guess, degrade honestly" posture as
// the muscle-group path's own zero-candidates case. Capped at
// exerciseCount same as every other selection path.
function selectStrengthFocusExercises(letter: TemplateLetter, safe: CatalogExercise[], exerciseCount: number): CatalogExercise[] {
  const bySafeKey = new Map(safe.map((e) => [e.key, e]));
  const picked: CatalogExercise[] = [];
  for (const key of STRENGTH_FOCUS_PLAN[letter].keys) {
    if (picked.length >= exerciseCount) break;
    const exercise = bySafeKey.get(key);
    if (exercise) picked.push(exercise);
  }
  return picked;
}

export interface TemplateExercisePick {
  key: string;
  name: string;
  muscleGroup: string;
}

export interface GeneratedTemplate {
  letter: TemplateLetter;
  exercises: TemplateExercisePick[];
}

// Only the injury/equipment exclusions apply here — no lastSession
// rotation (there's no single "last session" once exercises repeat across
// weeks) and no Strength-block compound preference (that's selectExercises'
// per-session bias for the goal-based fallback path; a template's own
// muscle-group priority list already leads with legs/compounds). Exercise
// count IS phase-specific (2026-08-29) — templates are already generated
// fresh per phase (see getTemplateSet's phase_index key), so there's no
// staleness risk in sizing a template to the phase active when it's built.
export function generateWorkoutTemplateSet(input: {
  profile: CoachProfile;
  availableEquipment?: EquipmentType[];
  activeBlock?: { blockType: BlockType; startedAt: string };
  now?: Date;
}): GeneratedTemplate[] {
  const { profile, availableEquipment, activeBlock, now = new Date() } = input;
  const excludedKeys = new Set([...getInjuryExcludedKeys(profile.injuries), ...getEquipmentExcludedKeys(availableEquipment)]);
  const safe = EXERCISE_CATALOG.filter((exercise) => !excludedKeys.has(exercise.key));
  const exerciseCount = computeExerciseCount(activeBlock, profile.goal, now);

  if (activeBlock?.blockType === "strength") {
    return TEMPLATE_LETTERS.map((letter) => {
      const exercises = selectStrengthFocusExercises(letter, safe, exerciseCount);
      return { letter, exercises: exercises.map((e) => ({ key: e.key, name: e.name, muscleGroup: e.muscleGroup })) };
    });
  }

  const usedKeys = new Set<string>();

  return TEMPLATE_LETTERS.map((letter) => {
    const groups = TEMPLATE_MUSCLE_GROUP_PRIORITY[letter].slice(0, Math.min(exerciseCount, TEMPLATE_MUSCLE_GROUP_PRIORITY[letter].length));
    // Plain loop rather than .map(), unlike before — usedInLetter has to
    // update mid-loop now that a muscle group (e.g. legs) can appear twice
    // in the same letter's groups list; a .map() only reading usedKeys
    // (updated once, after the whole letter finishes) would pick the exact
    // same exercise for both occurrences instead of two different ones.
    const usedInLetter = new Set<string>();
    const exercises: CatalogExercise[] = [];
    for (const muscleGroup of groups) {
      const candidates = safe.filter((e) => e.muscleGroup === muscleGroup && !usedInLetter.has(e.key));
      if (candidates.length === 0) continue;
      // Prefer an option no earlier template in this set has used yet, so
      // A/B/C differ as much as the catalog allows — falls back to reuse
      // only when a muscle group has no fresh candidate left (e.g.
      // shoulders/core before the 2026-08-27 catalog expansion, which had
      // exactly one option each).
      const fresh = candidates.filter((e) => !usedKeys.has(e.key));
      const chosen = (fresh.length > 0 ? fresh : candidates)[0];
      exercises.push(chosen);
      usedInLetter.add(chosen.key);
    }
    // A muscle group with zero eligible exercises left (heavy injury/
    // equipment exclusion, or the catalog exhausted for it) just means
    // fewer exercises than exerciseCount for this letter — same "never
    // guess, degrade honestly" posture as generateWorkout's own fallback
    // chain.

    for (const e of exercises) usedKeys.add(e.key);
    return { letter, exercises: exercises.map((e) => ({ key: e.key, name: e.name, muscleGroup: e.muscleGroup })) };
  });
}

// Stage 3 (2026-08-29) — "focus day" selection, one of two member-chosen
// alternatives to the default A/B/C rotation above (the other,
// build-your-own, needs no selection function at all: workout-session.ts
// builds its TemplateExercisePick[] straight from the member's own picks).
// Only injury/equipment exclusions apply, same as generateWorkoutTemplateSet
// — no lastSession rotation (this is a one-off choice, not a repeating
// template) and no Strength-block compound preference (same reasoning as
// that function's own comment).
const FOCUS_EXERCISE_MAX = 6;

// Picks up to FOCUS_EXERCISE_MAX exercises from the member's chosen
// muscle group(s), round-robining across groups (rather than exhausting
// the first group before touching the second) so a 2-group focus day
// balances between them. Selection only — instantiateTemplate below turns
// the result into a live weight/reps plan, same as every other selection
// function in this file.
export function pickFocusExercises(
  profile: CoachProfile,
  availableEquipment: EquipmentType[] | undefined,
  muscleGroups: MuscleGroup[]
): TemplateExercisePick[] {
  const excludedKeys = new Set([...getInjuryExcludedKeys(profile.injuries), ...getEquipmentExcludedKeys(availableEquipment)]);
  const byGroup = muscleGroups.map((group) => EXERCISE_CATALOG.filter((e) => e.muscleGroup === group && !excludedKeys.has(e.key)));

  const picked: CatalogExercise[] = [];
  for (let round = 0; picked.length < FOCUS_EXERCISE_MAX; round++) {
    const before = picked.length;
    for (const group of byGroup) {
      if (picked.length >= FOCUS_EXERCISE_MAX) break;
      const candidate = group[round];
      if (candidate) picked.push(candidate);
    }
    if (picked.length === before) break; // every chosen group's candidates exhausted
  }

  return picked.map((e) => ({ key: e.key, name: e.name, muscleGroup: e.muscleGroup }));
}

// Turns a chosen template's fixed exercise list into a live plan —
// weight and reps are computed fresh every time a template is used,
// exactly the way generateWorkout() always has, so RPE-driven
// progression keeps working across every repeat of the same template
// within its phase. A template exercise key that's somehow no longer in
// the catalog (shouldn't happen — nothing removes catalog entries) is
// skipped rather than crashing.
export function instantiateTemplate(
  templateExercises: TemplateExercisePick[],
  profile: CoachProfile,
  history: ExerciseHistoryEntry[],
  activeBlock: { blockType: BlockType; startedAt: string } | undefined,
  now: Date = new Date()
): GeneratedExercise[] {
  const repsTarget = repsTargetForBlock(activeBlock, profile.goal, now);
  const sets = activeBlock?.blockType === "deload" ? DELOAD_SETS_PER_EXERCISE : SETS_PER_EXERCISE;
  const historyByKey = new Map(history.map((h) => [h.exerciseKey, h]));

  return templateExercises
    .map((ex) => {
      const catalogEntry = EXERCISE_CATALOG.find((c) => c.key === ex.key);
      if (!catalogEntry) return null;
      return {
        key: ex.key,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets,
        repsTarget,
        weightTargetKg: computeWeightKgForBlock(catalogEntry, profile, historyByKey.get(ex.key), activeBlock),
      };
    })
    .filter((e): e is GeneratedExercise => e !== null);
}
