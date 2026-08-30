import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachProfile, getWorkoutHistory, type CoachProfile, type ExerciseHistoryEntry } from "@/lib/coach/coach-profile";
import {
  generateWorkout,
  getInjuryExcludedKeys,
  getEquipmentExcludedKeys,
  computeWeightKgForBlock,
  blockPhaseIndex,
  generateWorkoutTemplateSet,
  instantiateTemplate,
  pickFocusExercises,
  type GeneratedExercise,
  type TemplateExercisePick,
} from "@/lib/coach/generate-workout";
import { getTemplateSet, createTemplateSet, countSessionsForTemplates } from "@/lib/coach/workout-templates";
import { EXERCISE_CATALOG, type MuscleGroup } from "@/lib/coach/exercise-catalog";
import { narrateSessionIntro, narratePostSession } from "@/lib/coach-bot";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getActiveBlock } from "@/lib/coach/training-block-state";
import { DELOAD_WEIGHT_MULTIPLIER, type BlockType, type EquipmentType } from "@/lib/coach/types";
import { getWearableConnection, getLatestWearableSnapshot, getRecentWearableSnapshots } from "@/lib/data/wearables";
import { getRecoverySignal, type RecoverySignal } from "@/lib/coach/recovery-signal";
import { getLatestPainReport } from "@/lib/coach/check-ins";
import { getPainCaution, type PainCaution } from "@/lib/coach/pain-caution";

export interface WorkoutSet {
  id: number;
  setNumber: number;
  // Exactly one of these two is ever set — every non-circuit set still
  // gets repsTarget the same as always; durationSeconds is the circuit-
  // format alternative (Stage 2, 2026-08-29): a time-based movement (e.g.
  // a 30s plank hold within an AMRAP round) prescribed by duration
  // instead of a rep count. reps_target's DB NOT NULL was dropped for
  // this — a duration-based set genuinely has no rep count, same "blank,
  // not a guessed placeholder" reasoning as weightTargetKg below.
  repsTarget: number | null;
  durationSeconds: number | null;
  // null the first time a member does this exercise — see
  // generate-workout.ts's GeneratedExercise for the full reasoning.
  weightTargetKg: number | null;
  repsActual: number | null;
  weightActualKg: number | null;
  rpe: number | null;
  completedAt: string | null;
}

export interface WorkoutExercise {
  id: number;
  key: string;
  name: string;
  muscleGroup: string;
  // Custom-workout member override (Stage 1, 2026-08-29) — null for every
  // default/focus exercise and for a custom pick left at the builder's
  // default. Drives the "resting" screen between sets in workout-view.tsx;
  // null means no rest-timer screen, same self-paced behaviour as before.
  restSeconds: number | null;
  sets: WorkoutSet[];
}

// AMRAP fields (Stage 2, 2026-08-29) — timeCapSeconds is the prescription
// (set at generation), roundsCompleted/partialRoundExerciseIndex/
// partialRoundReps are the member's self-reported tally, null until
// completeAmrapSession writes them. format defaults to "straight_sets" at
// the DB level, so every pre-existing session (and every default/focus/
// straight-sets-custom one from here on) reads exactly that, unchanged.
// Rounds-For-Time (Stage 3, 2026-08-30) reuses roundsCompleted (always
// written equal to targetRounds once finished — v1 has no DNF) but leaves
// timeCapSeconds/partialRoundExerciseIndex/partialRoundReps null, since
// those are AMRAP-only concepts; targetRounds/elapsedSeconds below are
// RFT's own fields, see completeRoundsForTimeSession.
// HIIT (Stage 4, 2026-08-30) reuses targetRounds/roundsCompleted/
// elapsedSeconds too — same reuse convention RFT itself followed against
// AMRAP's columns — but leaves timeCapSeconds/partialRoundExerciseIndex/
// partialRoundReps null: there's no time cap (total duration is fully
// determined by the work/rest/rounds prescription) and no partial
// credit (v1 has no early-exit, so completion always writes the full
// target). See workSeconds/restSeconds/restBetweenRoundsSeconds below
// and completeHiitSession.
export type WorkoutFormat = "straight_sets" | "amrap" | "rounds_for_time" | "hiit";

// What loadSessionDetail alone can produce — it has no coach-profile
// access, so it can't compute excludedExerciseKeys itself. Callers that
// have (or can cheaply get) the member's profile attach that field on
// top; see WorkoutSessionDetail.
interface SessionExerciseDetail {
  sessionId: number;
  status: string;
  format: WorkoutFormat;
  timeCapSeconds: number | null;
  roundsCompleted: number | null;
  partialRoundExerciseIndex: number | null;
  partialRoundReps: number | null;
  // Rounds-For-Time (Stage 3, 2026-08-30) — targetRounds is the prescription
  // (set at generation), elapsedSeconds the member's stopwatch result (null
  // until completeRoundsForTimeSession writes it). Both null for every
  // non-RFT session. HIIT (Stage 4) also populates targetRounds/
  // elapsedSeconds (see WorkoutFormat above) — elapsedSeconds there is
  // server-computed at completion, never self-reported.
  targetRounds: number | null;
  elapsedSeconds: number | null;
  // HIIT (Stage 4, 2026-08-30) — the interval prescription set at
  // generation. All three null for every non-HIIT session.
  workSeconds: number | null;
  restSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  exercises: WorkoutExercise[];
}

export interface WorkoutSessionDetail extends SessionExerciseDetail {
  // Catalog keys the member's stated injuries exclude — same set
  // generation itself filters against (getInjuryExcludedKeys). Lets the
  // client build a safe exercise-swap candidate list without a second
  // round trip, while the actual swap is still independently
  // re-validated server-side.
  excludedExerciseKeys: string[];
  // Whether today's wearable data suggests a lighter session — surfaced
  // on the overview screen as a member-confirmed suggestion only
  // (applyRecoveryAdjustment below), never applied automatically.
  recoveryAdvice: RecoverySignal;
  // Whether the member's latest weekly check-in reported pain that's
  // still relevant to today's session (2026-08-30, coaching review — see
  // pain-caution.ts). Advisory only, same posture as recoveryAdvice —
  // never excludes an exercise, just names which of today's picks touch
  // the reported area so the member can go easy or swap it themselves.
  painCaution: PainCaution;
}

// Stage 12c real risk: the safe fallback on any error resolving the
// active block is undefined (today's already-safety-reviewed goal-based
// generation), never a hardcoded block type — a caught error must never
// silently produce e.g. "strength". startedAt is carried through (not
// just blockType) so generateWorkout can compute which 4-week rep-range
// phase is active (2026-08-25) — see REP_TARGET_BY_BLOCK_PHASE.
async function resolveActiveBlock(memberId: number, coachProfile: CoachProfile): Promise<{ blockType: BlockType; startedAt: string } | undefined> {
  try {
    const blockHistory = await getBlockHistory(memberId);
    return getActiveBlock(coachProfile, blockHistory);
  } catch (error) {
    console.error("[workout] failed to resolve active training block, falling back to goal-based generation", {
      error: (error as Error).message,
    });
    return undefined;
  }
}

// Empty array (including an unconfigured pod_resources row, or a
// resourceId that somehow doesn't resolve) means unrestricted — same
// "empty = today's exact behavior" semantics getEquipmentExcludedKeys
// already applies.
async function getResourceEquipment(resourceId: number): Promise<EquipmentType[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("pod_resources").select("equipment").eq("id", resourceId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.equipment as EquipmentType[] | null) ?? [];
}

function combineExcludedKeys(injuries: string | null, availableEquipment: EquipmentType[]): string[] {
  return [...new Set([...getInjuryExcludedKeys(injuries), ...getEquipmentExcludedKeys(availableEquipment)])];
}

// Stage 3 (2026-08-29) — drives the pre-generation "build your own"
// picker screen, which needs to know what's eligible *before* a session
// exists (getOrCreateWorkoutSession's own excludedExerciseKeys only ever
// gets computed as part of generating/loading one). No coach-profile-missing
// error here — an absent profile just means no injury exclusion data,
// same graceful-degradation the existing-session path in
// getOrCreateWorkoutSession already takes.
export async function getExcludedExerciseKeysForBooking(memberId: number, resourceId: number): Promise<string[]> {
  const profile = await getCoachProfile(memberId);
  const availableEquipment = await getResourceEquipment(resourceId);
  return combineExcludedKeys(profile?.injuries ?? null, availableEquipment);
}

// What the member chose on the pre-generation "choose" screen
// (workout-view.tsx) — "default" is the existing A/B/C-or-goal-based
// behaviour, byte-identical to before this existed. Both alternatives
// leave template_id null (see getOrCreateWorkoutSession below) so an
// off-plan day never consumes or skips the member's A/B/C rotation slot.
// customExerciseRests (2026-08-29, Stage 1 of the CrossFit-style custom-
// format work) — optional per-key rest-between-sets override, custom mode
// only. A key the member left at the builder's default (or that doesn't
// appear in the map at all) gets rest_seconds: null on its workout_exercises
// row, same as every non-custom exercise — no rest-timer screen shown.
// custom-amrap (Stage 2, 2026-08-29) — a genuinely different shape from
// every other mode: no RPE-driven weight/reps computation at all (the
// block/phase engine has nothing to say about a once-off circuit), so the
// member specifies each exercise's own prescription directly. Exactly one
// of reps/durationSeconds per exercise, validated in the route
// (generateWorkoutSchema) and re-checked in generateCircuitSession below.
export interface AmrapExercisePick {
  key: string;
  reps?: number;
  durationSeconds?: number;
  weightKg?: number;
}

// Rounds-For-Time (Stage 3, 2026-08-30; corrected same day after checking
// real CrossFit RFT WODs — see ROADMAP.md) — same circuit shape as AMRAP,
// but two real differences confirmed against actual RFT programming
// (thewodgenerator.com's RFT guide, "5 rounds for time: 10 KB swings, 15
// box jumps, 20 wall balls" style examples): every real RFT exercise is
// reps-based, never a timed hold (durationSeconds is rejected for this
// mode in generateCircuitSession — a fixed-duration movement can't be
// raced), and every real RFT WOD carries its own time cap (a member who
// doesn't finish by then gets a capped/DNF result, not an unbounded
// stopwatch) — timeCapSeconds is required here exactly like AMRAP's.
// targetRounds is still the prescription; the result is elapsed time
// (finished before the cap) or a self-reported partial tally at the cap
// (didn't finish) — see completeRoundsForTimeSession.
// HIIT (Stage 4, 2026-08-30) — a genuinely simpler shape than AMRAP/RFT's
// AmrapExercisePick: work/rest seconds and round count are set once for
// the whole session and apply uniformly as the timer cycles the picked
// exercises each round (Carl's own ask — no per-exercise reps/duration/
// weight). exerciseKeys is deliberately plain string[], not
// AmrapExercisePick[], and gets its own payload key on the wire
// (hiitExerciseKeys in workout-view.tsx/validation/workout.ts) rather
// than reusing "exercises"/"amrapExercises" — those two formats sharing
// one field name already caused a real client/server mismatch bug once
// (see workout-view.tsx's GenerateChoice comment).
export type WorkoutChoice =
  | { mode: "default" }
  | { mode: "focus"; focusMuscleGroups: MuscleGroup[] }
  | { mode: "custom"; customExerciseKeys: string[]; customExerciseRests?: Record<string, number> }
  | { mode: "custom-amrap"; timeCapSeconds: number; exercises: AmrapExercisePick[] }
  | { mode: "custom-rft"; targetRounds: number; timeCapSeconds: number; exercises: AmrapExercisePick[] }
  | {
      mode: "custom-hiit";
      workSeconds: number;
      restSeconds: number;
      rounds: number;
      restBetweenRoundsSeconds: number;
      exerciseKeys: string[];
    };

// A session the member already confirmed a recovery adjustment on must
// never show the banner again or be re-discountable — without this,
// reopening an unstarted session (exit and come back before starting)
// recomputed the signal fresh from the same live wearable data every
// time, re-showing "reduce today's session" after it had already been
// applied, and a second tap would re-multiply the already-discounted
// weight by DELOAD_WEIGHT_MULTIPLIER again. sessionId is null only for
// the brand-new-session path in getOrCreateWorkoutSession, where there's
// nothing to have been adjusted yet.
async function getSessionRecoveryAdjustedAt(sessionId: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("workout_sessions").select("recovery_adjusted_at").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.recovery_adjusted_at ?? null;
}

// No connection or no synced data at all both mean "nothing to assess
// yet" — same insufficient_data outcome as too thin a baseline, never a
// guess. Errors fail open to insufficient_data too, same posture as
// resolveActiveBlock's try/catch above: a wearables hiccup must never
// block a member from seeing their workout.
async function getRecoveryAdvice(memberId: number, sessionId: number | null): Promise<RecoverySignal> {
  try {
    if (sessionId !== null) {
      const adjustedAt = await getSessionRecoveryAdjustedAt(sessionId);
      if (adjustedAt !== null) return { kind: "normal" };
    }

    const connection = await getWearableConnection(memberId);
    if (!connection) return { kind: "insufficient_data" };

    const today = await getLatestWearableSnapshot(memberId);
    if (!today) return { kind: "insufficient_data" };

    const baseline = await getRecentWearableSnapshots(memberId);
    return getRecoverySignal(today, baseline);
  } catch (error) {
    console.error("[workout] failed to resolve recovery advice, defaulting to insufficient_data", {
      memberId,
      error: (error as Error).message,
    });
    return { kind: "insufficient_data" };
  }
}

// A check-in-fetch hiccup must not block a member from seeing their
// workout, same fail-open posture as getRecoveryAdvice above — defaults
// to "none" rather than surfacing an error for a purely advisory signal.
async function getPainCautionForSession(memberId: number, sessionExerciseKeys: string[]): Promise<PainCaution> {
  try {
    const painReport = await getLatestPainReport(memberId);
    return getPainCaution(painReport, sessionExerciseKeys);
  } catch (error) {
    console.error("[workout] failed to resolve pain caution, defaulting to none", {
      memberId,
      error: (error as Error).message,
    });
    return { kind: "none" };
  }
}

// Persistent Hypertrophy A/B/C rotation (2026-08-27, see
// generate-workout.ts's own comment on generateWorkoutTemplateSet for
// the product reasoning). Resolves this member's A/B/C set for the
// active block's current phase — generating it once, lazily, the first
// time a session lands in a phase that doesn't have one yet — then picks
// the next letter in rotation and turns its fixed exercise list into a
// live plan (weight/reps computed fresh, never stale from when the
// template was first created). Returns null (falls back to
// generateWorkout's original goal-based behavior) only if activeBlock
// itself is unavailable or template generation produced zero usable
// exercises (e.g. every catalog exercise excluded) — never a
// hardcoded/guessed plan, same safety posture as resolveActiveBlock's
// own try/catch below.
async function resolveTemplatedPlan(
  memberId: number,
  profile: CoachProfile,
  history: ExerciseHistoryEntry[],
  activeBlock: { blockType: BlockType; startedAt: string } | undefined,
  availableEquipment: EquipmentType[]
): Promise<{ plan: GeneratedExercise[]; templateId: number } | null> {
  if (!activeBlock) return null;

  const phaseIndex = blockPhaseIndex(activeBlock.startedAt, new Date());
  let templates = await getTemplateSet(memberId, activeBlock.blockType, activeBlock.startedAt, phaseIndex);

  if (templates.length === 0) {
    const generated = generateWorkoutTemplateSet({ profile, availableEquipment, activeBlock });
    templates = await createTemplateSet(memberId, activeBlock.blockType, activeBlock.startedAt, phaseIndex, generated);
    if (templates.length === 0) {
      // Lost a create race to a concurrent request (or generation itself
      // produced nothing) — reload whatever a concurrent winner created;
      // still empty after that means real exclusion, not a race.
      templates = await getTemplateSet(memberId, activeBlock.blockType, activeBlock.startedAt, phaseIndex);
    }
  }
  if (templates.length === 0) return null;

  const usedCount = await countSessionsForTemplates(templates.map((t) => t.id));
  const chosen = templates[usedCount % templates.length];
  const plan = instantiateTemplate(chosen.exercises, profile, history, activeBlock);
  if (plan.length === 0) return null;

  return { plan, templateId: chosen.id };
}

// Lightweight status-only lookup for Home's "Today's Mission" card — avoids
// pulling the full exercise/set detail loadSessionDetail returns when only
// "has this booking's workout been started/completed" is needed.
export async function getSessionStatusForBooking(bookingId: number): Promise<"not_started" | "completed" | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("workout_sessions").select("status").eq("booking_id", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data.status === "completed" ? "completed" : "not_started";
}

// Fetches an existing workout_session (with exercises/sets) for a booking,
// or generates + persists a new one. Idempotent on booking_id's unique
// index — a member re-opening the same booked session's workout screen
// must see the same plan, not a freshly regenerated one.
export async function getOrCreateWorkoutSession(
  memberId: number,
  bookingId: number,
  resourceId: number,
  memberName: string,
  choice: WorkoutChoice = { mode: "default" }
): Promise<{ detail: WorkoutSessionDetail; introNarration: string | null }> {
  const admin = createAdminClient();
  const availableEquipment = await getResourceEquipment(resourceId);

  const { data: existing } = await admin.from("workout_sessions").select("id, status").eq("booking_id", bookingId).maybeSingle();

  if (existing) {
    // Doesn't require a coach profile here (unlike the fresh-generation
    // path below) — an already-generated session must still load even if
    // something odd happened to the profile afterward; a missing profile
    // just means no exclusion data to offer for swapping.
    const existingProfile = await getCoachProfile(memberId);
    const detail = await loadSessionDetail(existing.id);
    return {
      detail: {
        ...detail,
        excludedExerciseKeys: combineExcludedKeys(existingProfile?.injuries ?? null, availableEquipment),
        recoveryAdvice: await getRecoveryAdvice(memberId, existing.id),
        painCaution: await getPainCautionForSession(
          memberId,
          detail.exercises.map((e) => e.key)
        ),
      },
      introNarration: null,
    };
  }

  return generateAndPersistSession(memberId, bookingId, resourceId, memberName, choice, availableEquipment);
}

// Whether any set in this session has already been logged (completed_at
// set) — the gate for "Change today's workout" below: once a member has
// started, swapping the plan would discard real logged data, so the
// option simply stops being offered rather than needing a keep/discard
// decision (Carl's call, 2026-08-29).
export async function hasSessionStarted(sessionId: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data: exercises, error: exercisesError } = await admin.from("workout_exercises").select("id").eq("session_id", sessionId);
  if (exercisesError) throw new Error(exercisesError.message);
  const exerciseIds = (exercises ?? []).map((e) => e.id);
  if (exerciseIds.length === 0) return false;

  const { count, error } = await admin
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .in("exercise_id", exerciseIds)
    .not("completed_at", "is", null);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// "Change today's workout" (2026-08-29) — replaces the old pre-generation
// choose screen: every booking now always generates the default A/B/C
// plan immediately (see workout-view.tsx), and this is the only remaining
// way to switch to a focus/custom session, offered on the overview screen
// behind a program-hopping warning. Throws "session_already_started" if
// hasSessionStarted is true — the caller (the API route) turns that into a
// 409, and the client never offers this action past that point anyway.
export async function changeWorkoutMode(
  memberId: number,
  bookingId: number,
  resourceId: number,
  memberName: string,
  choice: WorkoutChoice
): Promise<{ detail: WorkoutSessionDetail; introNarration: string | null }> {
  const admin = createAdminClient();
  const availableEquipment = await getResourceEquipment(resourceId);

  const { data: existing, error: existingError } = await admin.from("workout_sessions").select("id").eq("booking_id", bookingId).maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    if (await hasSessionStarted(existing.id)) {
      throw new Error("session_already_started");
    }

    // No cascade delete on these FKs (0049_workout_sessions.sql) — delete
    // children before the session row itself. Safe to discard: the
    // hasSessionStarted check above already confirmed nothing here has
    // been logged, so this is target/plan data only, never real history.
    const { data: exercises, error: exercisesError } = await admin.from("workout_exercises").select("id").eq("session_id", existing.id);
    if (exercisesError) throw new Error(exercisesError.message);
    const exerciseIds = (exercises ?? []).map((e) => e.id);
    if (exerciseIds.length > 0) {
      const { error: deleteSetsError } = await admin.from("workout_sets").delete().in("exercise_id", exerciseIds);
      if (deleteSetsError) throw new Error(deleteSetsError.message);
      const { error: deleteExercisesError } = await admin.from("workout_exercises").delete().eq("session_id", existing.id);
      if (deleteExercisesError) throw new Error(deleteExercisesError.message);
    }
    const { error: deleteSessionError } = await admin.from("workout_sessions").delete().eq("id", existing.id);
    if (deleteSessionError) throw new Error(deleteSessionError.message);
  }

  return generateAndPersistSession(memberId, bookingId, resourceId, memberName, choice, availableEquipment);
}

// Everything getOrCreateWorkoutSession needs once it's established there's
// no existing session to load — also reused by changeWorkoutMode below
// (2026-08-29) once it's cleared the old session away, so "generate a fresh
// plan for this booking" has exactly one implementation regardless of which
// caller triggers it.
async function generateAndPersistSession(
  memberId: number,
  bookingId: number,
  resourceId: number,
  memberName: string,
  choice: WorkoutChoice,
  availableEquipment: EquipmentType[]
): Promise<{ detail: WorkoutSessionDetail; introNarration: string | null }> {
  const admin = createAdminClient();

  // AMRAP/Rounds-For-Time are a genuinely different shape from every other
  // mode below — no RPE-driven weight/reps computation at all (the
  // block/phase engine has nothing to say about a once-off member-authored
  // circuit) — so they're a fully separate branch rather than another `if`
  // alongside focus/custom.
  if (choice.mode === "custom-amrap" || choice.mode === "custom-rft") {
    return generateCircuitSession(admin, memberId, bookingId, resourceId, choice, availableEquipment);
  }

  // HIIT (Stage 4, 2026-08-30) is its own branch, not a third case inside
  // generateCircuitSession — its exercise-list shape (plain keys, no
  // per-exercise reps/duration/weight) and DB writes (work/rest/rounds
  // prescription instead of a per-exercise reps-or-duration split) differ
  // enough that forcing it into the shared function would just be an
  // extra layer of mode-branching inside an already mode-branching
  // function. Same graceful-degradation/no-narration posture as
  // generateCircuitSession, so it's structured as a close sibling.
  if (choice.mode === "custom-hiit") {
    return generateHiitSession(admin, memberId, bookingId, resourceId, choice, availableEquipment);
  }

  const profile = await getCoachProfile(memberId);
  if (!profile) {
    throw new Error("coach_profile_missing");
  }

  const { history, lastSession } = await getWorkoutHistory(memberId);
  const activeBlock = await resolveActiveBlock(memberId, profile);

  // Stage 3 (2026-08-29) — "focus" and "custom" are member overrides for
  // this one session only (fresh choice every time, no remembered
  // preference — Carl's call). Both leave templateId null below, same as
  // the existing default-mode fallback already did, so an off-plan day
  // never consumes or skips the member's A/B/C rotation slot.
  let plan: GeneratedExercise[];
  let templateId: number | null = null;
  let restByKey: Record<string, number> | undefined;

  if (choice.mode === "focus") {
    const picks = pickFocusExercises(profile, availableEquipment, choice.focusMuscleGroups);
    plan = instantiateTemplate(picks, profile, history, activeBlock);
    if (plan.length === 0) throw new Error("no_eligible_exercises");
  } else if (choice.mode === "custom") {
    // Never trust the client's list wholesale — re-validated against the
    // live catalog and the same injury/equipment exclusions
    // getExcludedExerciseKeysForBooking offered the picker, same posture
    // swapExercise already takes for a single-exercise swap. An
    // invalid/excluded/duplicate key is silently dropped rather than
    // erroring the whole session, since the picker's own candidate list
    // should already prevent this in the honest case.
    const excludedKeys = combineExcludedKeys(profile.injuries, availableEquipment);
    const picks: TemplateExercisePick[] = [];
    for (const key of choice.customExerciseKeys) {
      const entry = EXERCISE_CATALOG.find((e) => e.key === key);
      if (!entry || excludedKeys.includes(key) || picks.some((p) => p.key === key)) continue;
      picks.push({ key: entry.key, name: entry.name, muscleGroup: entry.muscleGroup });
    }
    plan = instantiateTemplate(picks, profile, history, activeBlock);
    if (plan.length === 0) throw new Error("no_eligible_exercises");
    // Only the picked exercises' own keys matter — an entry in the
    // client-supplied map for a key that got dropped above (invalid/
    // excluded/duplicate) is simply never read.
    restByKey = choice.customExerciseRests;
  } else {
    const templated = await resolveTemplatedPlan(memberId, profile, history, activeBlock, availableEquipment);
    plan = templated?.plan ?? generateWorkout({ profile, history, lastSession, activeBlock, availableEquipment });
    templateId = templated?.templateId ?? null;
  }

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .insert({
      member_id: memberId,
      booking_id: bookingId,
      resource_id: resourceId,
      status: "generated",
      template_id: templateId,
    })
    .select("id")
    .single();

  if (sessionError) {
    // A concurrent request for the same booking (React Strict Mode's
    // dev-only double-effect-fire is the known trigger, but any duplicate
    // in-flight request would hit this the same way) can win the race
    // between our existence check above and this insert. The unique index
    // on booking_id is the real guard — recover by loading whatever that
    // other request already created instead of surfacing a 500; we never
    // reach insertExercisesAndSets below, so there's no risk of a
    // duplicate plan being written for this session.
    if (sessionError.code === "23505") {
      const { data: winner, error: winnerError } = await admin
        .from("workout_sessions")
        .select("id")
        .eq("booking_id", bookingId)
        .single();
      if (winnerError) throw new Error(winnerError.message);
      const detail = await loadSessionDetail(winner.id);
      return {
        detail: {
          ...detail,
          excludedExerciseKeys: combineExcludedKeys(profile.injuries, availableEquipment),
          recoveryAdvice: await getRecoveryAdvice(memberId, winner.id),
          painCaution: await getPainCautionForSession(
            memberId,
            detail.exercises.map((e) => e.key)
          ),
        },
        introNarration: null,
      };
    }
    throw new Error(sessionError.message);
  }

  await insertExercisesAndSets(session.id, plan, restByKey);

  let introNarration: string | null = null;
  try {
    introNarration = await narrateSessionIntro(memberName, plan);
  } catch (error) {
    // Narration is presentation-only — a Groq/Claude hiccup must not block
    // a member from seeing their (already-generated, already-saved) plan.
    console.error("[workout] narration failed", { error: (error as Error).message });
  }

  const detail = await loadSessionDetail(session.id);
  return {
    detail: {
      ...detail,
      excludedExerciseKeys: combineExcludedKeys(profile.injuries, availableEquipment),
      recoveryAdvice: await getRecoveryAdvice(memberId, session.id),
      painCaution: await getPainCautionForSession(
        memberId,
        detail.exercises.map((e) => e.key)
      ),
    },
    introNarration,
  };
}

// AMRAP/Rounds-For-Time generation (Stage 2, 2026-08-29; RFT added Stage 3,
// 2026-08-30) — no coach-profile-missing hard-block the way every other
// mode has: there's no weight/reps computation needing profile data, only
// injury filtering, and a missing profile there just means no exclusion
// data (same graceful-degradation getExcludedExerciseKeysForBooking
// already uses). No intro narration either — narrateSessionIntro expects a
// GeneratedExercise[] shaped by the RPE-driven engine, which a
// member-authored circuit never goes through; skipped rather than
// reshaping this into that engine's input. Both circuit formats share
// this one generator — they differ only in which session-level
// prescription field gets written (time_cap_seconds vs target_rounds).
async function generateCircuitSession(
  admin: ReturnType<typeof createAdminClient>,
  memberId: number,
  bookingId: number,
  resourceId: number,
  choice: Extract<WorkoutChoice, { mode: "custom-amrap" | "custom-rft" }>,
  availableEquipment: EquipmentType[]
): Promise<{ detail: WorkoutSessionDetail; introNarration: string | null }> {
  const profile = await getCoachProfile(memberId);
  const excludedKeys = combineExcludedKeys(profile?.injuries ?? null, availableEquipment);

  // Never trust the client's list wholesale, same posture as every other
  // mode — re-validated against the live catalog and injury/equipment
  // exclusions. An invalid/excluded/duplicate key, or one missing its
  // required prescription, is dropped rather than guessed at.
  const picks: { key: string; name: string; muscleGroup: string; reps: number | null; durationSeconds: number | null; weightKg: number | null }[] = [];
  for (const ex of choice.exercises) {
    const entry = EXERCISE_CATALOG.find((e) => e.key === ex.key);
    if (!entry || excludedKeys.includes(ex.key) || picks.some((p) => p.key === ex.key)) continue;
    const hasReps = typeof ex.reps === "number" && ex.reps > 0;
    const hasDuration = typeof ex.durationSeconds === "number" && ex.durationSeconds > 0;
    // RFT is reps-only — real Rounds-For-Time WODs prescribe reps per
    // round ("5 rounds for time: 10 KB swings..."), never a timed hold; a
    // fixed-duration movement can't be raced against the clock the way
    // RFT's whole scoring mechanic depends on. AMRAP keeps its original
    // exactly-one-of-either rule (HIIT-style AMRAPs are legitimately
    // duration-based).
    if (choice.mode === "custom-rft" ? !hasReps || hasDuration : hasReps === hasDuration) continue;
    picks.push({
      key: entry.key,
      name: entry.name,
      muscleGroup: entry.muscleGroup,
      reps: hasReps ? ex.reps! : null,
      durationSeconds: hasDuration ? ex.durationSeconds! : null,
      weightKg: typeof ex.weightKg === "number" && ex.weightKg > 0 ? ex.weightKg : null,
    });
  }
  if (picks.length === 0) throw new Error("no_eligible_exercises");

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .insert({
      member_id: memberId,
      booking_id: bookingId,
      resource_id: resourceId,
      status: "generated",
      format: choice.mode === "custom-amrap" ? "amrap" : "rounds_for_time",
      // Both circuit formats require a time cap now — RFT's is a real
      // DNF cutoff (see completeRoundsForTimeSession), not left null.
      time_cap_seconds: choice.timeCapSeconds,
      target_rounds: choice.mode === "custom-rft" ? choice.targetRounds : null,
    })
    .select("id")
    .single();

  if (sessionError) {
    // Same concurrent-request race recovery as generateAndPersistSession's
    // straight-sets insert above — the unique index on booking_id is the
    // real guard.
    if (sessionError.code === "23505") {
      const { data: winner, error: winnerError } = await admin.from("workout_sessions").select("id").eq("booking_id", bookingId).single();
      if (winnerError) throw new Error(winnerError.message);
      const detail = await loadSessionDetail(winner.id);
      return {
        detail: {
          ...detail,
          excludedExerciseKeys: excludedKeys,
          recoveryAdvice: { kind: "insufficient_data" },
          painCaution: await getPainCautionForSession(
            memberId,
            detail.exercises.map((e) => e.key)
          ),
        },
        introNarration: null,
      };
    }
    throw new Error(sessionError.message);
  }

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const { data: exerciseRow, error: exerciseError } = await admin
      .from("workout_exercises")
      .insert({ session_id: session.id, exercise_key: pick.key, name: pick.name, muscle_group: pick.muscleGroup, sort_order: i })
      .select("id")
      .single();
    if (exerciseError) throw new Error(exerciseError.message);

    // One workout_sets row per exercise (set_number 1) — a circuit
    // exercise has no discrete "sets" concept the way straight sets does;
    // this row is purely the round's prescription for that movement,
    // never logged/completed per-set (see completeAmrapSession).
    const { error: setError } = await admin.from("workout_sets").insert({
      exercise_id: exerciseRow.id,
      set_number: 1,
      reps_target: pick.reps,
      duration_seconds: pick.durationSeconds,
      weight_target_kg: pick.weightKg,
    });
    if (setError) throw new Error(setError.message);
  }

  const detail = await loadSessionDetail(session.id);
  return {
    detail: {
      ...detail,
      excludedExerciseKeys: excludedKeys,
      recoveryAdvice: { kind: "insufficient_data" },
      painCaution: await getPainCautionForSession(
        memberId,
        detail.exercises.map((e) => e.key)
      ),
    },
    introNarration: null,
  };
}

// HIIT generation (Stage 4, 2026-08-30) — same graceful-degradation
// posture as generateCircuitSession (no coach-profile hard-block, only
// injury filtering), but simpler validation: no reps-vs-duration branch,
// since HIIT's work/rest timing is uniform across the whole session
// (set once, not per exercise). time_cap_seconds stays null — HIIT has
// no time cap, the total duration is fully determined by the
// prescription (see completeHiitSession).
async function generateHiitSession(
  admin: ReturnType<typeof createAdminClient>,
  memberId: number,
  bookingId: number,
  resourceId: number,
  choice: Extract<WorkoutChoice, { mode: "custom-hiit" }>,
  availableEquipment: EquipmentType[]
): Promise<{ detail: WorkoutSessionDetail; introNarration: string | null }> {
  const profile = await getCoachProfile(memberId);
  const excludedKeys = combineExcludedKeys(profile?.injuries ?? null, availableEquipment);

  // Never trust the client's list wholesale, same posture as
  // generateCircuitSession — re-validated against the live catalog and
  // injury/equipment exclusions. An invalid/excluded/duplicate key is
  // dropped rather than guessed at.
  const picks: { key: string; name: string; muscleGroup: string }[] = [];
  for (const key of choice.exerciseKeys) {
    const entry = EXERCISE_CATALOG.find((e) => e.key === key);
    if (!entry || excludedKeys.includes(key) || picks.some((p) => p.key === key)) continue;
    picks.push({ key: entry.key, name: entry.name, muscleGroup: entry.muscleGroup });
  }
  if (picks.length === 0) throw new Error("no_eligible_exercises");

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .insert({
      member_id: memberId,
      booking_id: bookingId,
      resource_id: resourceId,
      status: "generated",
      format: "hiit",
      work_seconds: choice.workSeconds,
      rest_seconds: choice.restSeconds,
      rest_between_rounds_seconds: choice.restBetweenRoundsSeconds,
      target_rounds: choice.rounds,
    })
    .select("id")
    .single();

  if (sessionError) {
    // Same concurrent-request race recovery as generateCircuitSession's
    // own insert above — the unique index on booking_id is the real
    // guard.
    if (sessionError.code === "23505") {
      const { data: winner, error: winnerError } = await admin.from("workout_sessions").select("id").eq("booking_id", bookingId).single();
      if (winnerError) throw new Error(winnerError.message);
      const detail = await loadSessionDetail(winner.id);
      return {
        detail: {
          ...detail,
          excludedExerciseKeys: excludedKeys,
          recoveryAdvice: { kind: "insufficient_data" },
          painCaution: await getPainCautionForSession(
            memberId,
            detail.exercises.map((e) => e.key)
          ),
        },
        introNarration: null,
      };
    }
    throw new Error(sessionError.message);
  }

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const { data: exerciseRow, error: exerciseError } = await admin
      .from("workout_exercises")
      .insert({ session_id: session.id, exercise_key: pick.key, name: pick.name, muscle_group: pick.muscleGroup, sort_order: i })
      .select("id")
      .single();
    if (exerciseError) throw new Error(exerciseError.message);

    // One workout_sets row per exercise (set_number 1), duration_seconds
    // set to the session's uniform work interval so the existing
    // duration-based set rendering needs no changes — same "no discrete
    // sets concept" posture as generateCircuitSession's own rows.
    const { error: setError } = await admin.from("workout_sets").insert({
      exercise_id: exerciseRow.id,
      set_number: 1,
      reps_target: null,
      duration_seconds: choice.workSeconds,
      weight_target_kg: null,
    });
    if (setError) throw new Error(setError.message);
  }

  const detail = await loadSessionDetail(session.id);
  return {
    detail: {
      ...detail,
      excludedExerciseKeys: excludedKeys,
      recoveryAdvice: { kind: "insufficient_data" },
      painCaution: await getPainCautionForSession(
        memberId,
        detail.exercises.map((e) => e.key)
      ),
    },
    introNarration: null,
  };
}

async function insertExercisesAndSets(sessionId: number, plan: GeneratedExercise[], restByKey?: Record<string, number>): Promise<void> {
  const admin = createAdminClient();

  for (let i = 0; i < plan.length; i++) {
    const exercise = plan[i];
    const { data: exerciseRow, error: exerciseError } = await admin
      .from("workout_exercises")
      .insert({
        session_id: sessionId,
        exercise_key: exercise.key,
        name: exercise.name,
        muscle_group: exercise.muscleGroup,
        sort_order: i,
        rest_seconds: restByKey?.[exercise.key] ?? null,
      })
      .select("id")
      .single();
    if (exerciseError) throw new Error(exerciseError.message);

    // Reads the per-exercise sets count off the generated plan item — a
    // deload block returns fewer sets than the usual 3, and hardcoding a
    // constant here would silently defeat that volume reduction.
    const setsToInsert = Array.from({ length: exercise.sets }).map((_, setIndex) => ({
      exercise_id: exerciseRow.id,
      set_number: setIndex + 1,
      reps_target: exercise.repsTarget,
      weight_target_kg: exercise.weightTargetKg,
    }));
    const { error: setsError } = await admin.from("workout_sets").insert(setsToInsert);
    if (setsError) throw new Error(setsError.message);
  }
}

export async function loadSessionDetail(sessionId: number): Promise<SessionExerciseDetail> {
  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .select(
      "id, status, format, time_cap_seconds, rounds_completed, partial_round_exercise_index, partial_round_reps, target_rounds, elapsed_seconds, work_seconds, rest_seconds, rest_between_rounds_seconds"
    )
    .eq("id", sessionId)
    .single();
  if (sessionError) throw new Error(sessionError.message);

  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, exercise_key, name, muscle_group, sort_order, rest_seconds")
    .eq("session_id", sessionId)
    .order("sort_order");
  if (exercisesError) throw new Error(exercisesError.message);

  const exerciseIds = (exercises ?? []).map((e) => e.id);
  const { data: sets, error: setsError } =
    exerciseIds.length > 0
      ? await admin.from("workout_sets").select("*").in("exercise_id", exerciseIds).order("set_number")
      : { data: [], error: null };
  if (setsError) throw new Error(setsError.message);

  return {
    sessionId: session.id,
    status: session.status,
    format: session.format as WorkoutFormat,
    timeCapSeconds: session.time_cap_seconds,
    roundsCompleted: session.rounds_completed,
    partialRoundExerciseIndex: session.partial_round_exercise_index,
    partialRoundReps: session.partial_round_reps,
    targetRounds: session.target_rounds,
    elapsedSeconds: session.elapsed_seconds,
    workSeconds: session.work_seconds,
    restSeconds: session.rest_seconds,
    restBetweenRoundsSeconds: session.rest_between_rounds_seconds,
    exercises: (exercises ?? []).map((e) => ({
      id: e.id,
      key: e.exercise_key,
      name: e.name,
      muscleGroup: e.muscle_group,
      restSeconds: e.rest_seconds,
      sets: (sets ?? [])
        .filter((s) => s.exercise_id === e.id)
        .map((s) => ({
          id: s.id,
          setNumber: s.set_number,
          repsTarget: s.reps_target,
          durationSeconds: s.duration_seconds,
          weightTargetKg: s.weight_target_kg,
          repsActual: s.reps_actual,
          weightActualKg: s.weight_actual_kg,
          rpe: s.rpe,
          completedAt: s.completed_at,
        })),
    })),
  };
}

// IDOR guard shared by log-set/complete — resolves a workout_sets.id (or
// workout_sessions.id) back to its owning member_id via the same join
// chain the RLS policies use, so the route can verify ownership before
// writing.
export async function getSessionOwnerMemberId(sessionId: number): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("workout_sessions").select("member_id").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.member_id ?? null;
}

// resource_id has been on workout_sessions since resources existed (see
// the insert in getOrCreateWorkoutSession) — nothing needed to read it
// back until swapExercise's equipment re-validation below.
async function getSessionResourceId(sessionId: number): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("workout_sessions").select("resource_id").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.resource_id ?? null;
}

// Swaps one exercise in an as-yet-unstarted session for a same-muscle-
// group alternative, chosen by the member on the overview screen before
// tapping "Start workout". Never trusts the client's copy of what's
// allowed — re-derives eligibility, the muscle-group match, the injury
// exclusion, and the duplicate check from live data, the same "never
// trust client" posture as the training-block confirm route.
export async function swapExercise(
  memberId: number,
  sessionId: number,
  exerciseId: number,
  newExerciseKey: string
): Promise<WorkoutSessionDetail> {
  const admin = createAdminClient();

  const detail = await loadSessionDetail(sessionId);
  const exerciseRow = detail.exercises.find((e) => e.id === exerciseId);
  if (!exerciseRow) {
    throw new Error("exercise_not_found");
  }

  // Real gate the exercise-swap design almost got wrong: workout_sessions
  // .status never leaves 'generated' until completeSession() sets it to
  // 'completed' — there is no in-progress status value — so checking
  // status here would wrongly allow a swap mid-session. The real signal
  // is whether any set in this session has actually been logged yet.
  const hasProgress = detail.exercises.some((e) => e.sets.some((s) => s.completedAt));
  if (hasProgress) {
    throw new Error("session_already_started");
  }

  const newExercise = EXERCISE_CATALOG.find((e) => e.key === newExerciseKey);
  if (!newExercise || newExercise.muscleGroup !== exerciseRow.muscleGroup) {
    throw new Error("invalid_exercise");
  }

  const profile = await getCoachProfile(memberId);
  if (!profile) {
    throw new Error("coach_profile_missing");
  }

  // Equipment re-validation — the one path that had zero gym/resource
  // awareness before this existed: without it a member could swap into
  // an exercise their actual pod can't support, even though the client's
  // own candidate list (built from excludedExerciseKeys) would never
  // offer it.
  const resourceId = await getSessionResourceId(sessionId);
  const availableEquipment = resourceId !== null ? await getResourceEquipment(resourceId) : [];
  const excludedKeys = combineExcludedKeys(profile.injuries, availableEquipment);
  if (excludedKeys.includes(newExerciseKey)) {
    throw new Error("invalid_exercise");
  }

  const otherKeys = detail.exercises.filter((e) => e.id !== exerciseId).map((e) => e.key);
  if (otherKeys.includes(newExerciseKey)) {
    throw new Error("duplicate_exercise");
  }

  const { history } = await getWorkoutHistory(memberId);
  const activeBlock = await resolveActiveBlock(memberId, profile);
  const prior = history.find((h) => h.exerciseKey === newExerciseKey);
  const weightTargetKg = computeWeightKgForBlock(newExercise, profile, prior, activeBlock);

  // A plain UPDATE — never delete+reinsert — so sort_order (and every
  // set's id/set_number) is preserved automatically.
  const { error: exerciseUpdateError } = await admin
    .from("workout_exercises")
    .update({ exercise_key: newExercise.key, name: newExercise.name })
    .eq("id", exerciseId);
  if (exerciseUpdateError) throw new Error(exerciseUpdateError.message);

  // Only weight_target_kg changes — reps_target/sets are session-wide
  // (driven by goal/block), not per-exercise, so they're left untouched.
  const { error: setsUpdateError } = await admin
    .from("workout_sets")
    .update({ weight_target_kg: weightTargetKg })
    .eq("exercise_id", exerciseId);
  if (setsUpdateError) throw new Error(setsUpdateError.message);

  const updated = await loadSessionDetail(sessionId);
  return {
    ...updated,
    excludedExerciseKeys: excludedKeys,
    recoveryAdvice: await getRecoveryAdvice(memberId, sessionId),
    painCaution: await getPainCautionForSession(
      memberId,
      updated.exercises.map((e) => e.key)
    ),
  };
}

// Member-confirmed-only counterpart to the deload block's automatic
// discount — reuses DELOAD_WEIGHT_MULTIPLIER rather than inventing a
// second constant, deliberately weight-only (not a set-count reduction
// too, unlike a real deload block): keeps this a single UPDATE, minimal,
// non-destructive. Same ownership + hasProgress guard as swapExercise —
// never allowed once a set has actually been logged. Also rejects a
// second application on the same session (recovery_adjusted_at already
// set) — without this, exiting and reopening an unstarted session before
// starting it let a member tap "Reduce" again and re-multiply the
// already-discounted weight by DELOAD_WEIGHT_MULTIPLIER a second time,
// compounding the reduction. Found via a user-perspective walkthrough,
// 2026-08-24, the same day this shipped.
export async function applyRecoveryAdjustment(memberId: number, sessionId: number): Promise<WorkoutSessionDetail> {
  const admin = createAdminClient();

  const detail = await loadSessionDetail(sessionId);
  const hasProgress = detail.exercises.some((e) => e.sets.some((s) => s.completedAt));
  if (hasProgress) {
    throw new Error("session_already_started");
  }

  const alreadyAdjusted = await getSessionRecoveryAdjustedAt(sessionId);
  if (alreadyAdjusted !== null) {
    throw new Error("recovery_already_applied");
  }

  const exerciseIds = detail.exercises.map((e) => e.id);
  if (exerciseIds.length > 0) {
    const { data: sets, error: setsError } = await admin.from("workout_sets").select("id, weight_target_kg").in("exercise_id", exerciseIds);
    if (setsError) throw new Error(setsError.message);

    for (const set of sets ?? []) {
      // A still-blank target (first time doing this exercise, member
      // hasn't logged their own weight yet) has nothing to discount —
      // `null * multiplier` would silently become 0 in JS, corrupting a
      // genuine blank slate into a real (wrong) 0kg suggestion.
      if (set.weight_target_kg === null) continue;
      const { error: updateError } = await admin
        .from("workout_sets")
        .update({ weight_target_kg: roundToNearestPlateForAdjustment(set.weight_target_kg * DELOAD_WEIGHT_MULTIPLIER) })
        .eq("id", set.id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  const { error: markAdjustedError } = await admin
    .from("workout_sessions")
    .update({ recovery_adjusted_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (markAdjustedError) throw new Error(markAdjustedError.message);

  const updated = await loadSessionDetail(sessionId);
  const profile = await getCoachProfile(memberId);
  const resourceId = await getSessionResourceId(sessionId);
  const availableEquipment = resourceId !== null ? await getResourceEquipment(resourceId) : [];
  return {
    ...updated,
    excludedExerciseKeys: combineExcludedKeys(profile?.injuries ?? null, availableEquipment),
    recoveryAdvice: await getRecoveryAdvice(memberId, sessionId),
    painCaution: await getPainCautionForSession(
      memberId,
      updated.exercises.map((e) => e.key)
    ),
  };
}

// Same rounding convention as generate-workout.ts's roundToNearestPlate —
// duplicated rather than imported since that one isn't exported (kept
// private to the weight-picking module) and this is one small function.
function roundToNearestPlateForAdjustment(kg: number, increment = 1.25): number {
  if (kg === 0) return 0;
  return Math.round(kg / increment) * increment;
}

export async function logSet(
  setId: number,
  input: { repsActual: number; weightActualKg: number; rpe?: number }
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("workout_sets")
    .update({
      reps_actual: input.repsActual,
      weight_actual_kg: input.weightActualKg,
      rpe: input.rpe ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", setId);
  if (error) throw new Error(error.message);
}

export interface WeightChangePreview {
  name: string;
  oldWeightKg: number;
  newWeightKg: number;
  lastRpe: number | null;
}

// AMRAP completion (Stage 2, 2026-08-29) — a circuit format has no
// discrete logged sets to derive volume/changes from the way
// completeSession below does, so this is a separate, much simpler
// function: just records the member's self-reported final tally (same
// trust posture as RPE/weight everywhere else in this app — no
// rep-counting sensors) and marks the session done. partialRoundReps
// pairs with partialRoundExerciseIndex — both null together means the
// member finished exactly on a round boundary, nothing partial to record.
export interface AmrapTally {
  roundsCompleted: number;
  partialRoundExerciseIndex: number | null;
  partialRoundReps: number | null;
}

export async function completeAmrapSession(sessionId: number, tally: AmrapTally): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("workout_sessions")
    .update({
      status: "completed",
      rounds_completed: tally.roundsCompleted,
      partial_round_exercise_index: tally.partialRoundExerciseIndex,
      partial_round_reps: tally.partialRoundReps,
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

// Rounds-For-Time completion (Stage 3, 2026-08-30; corrected same day —
// real RFT WODs carry a time cap, so a member CAN fail to finish, unlike
// the earlier no-DNF v1). Two real outcomes: finished before the cap
// (roundsCompleted === the session's own targetRounds, elapsedSeconds is
// the client's real stopwatch reading) or capped out (workout-view.tsx
// auto-transitions to a tally screen once the stopwatch hits the cap,
// same self-report trust posture as AMRAP's own tally — round count and
// partial-round progress aren't sensor-measurable, only the member knows).
// Either way this never trusts the client past the session's own stored
// prescription: roundsCompleted is clamped to targetRounds and
// elapsedSeconds to timeCapSeconds, so a normal early finish (always <
// the cap) passes through unclamped while a bogus over-cap claim can't.
export interface RftResult {
  elapsedSeconds: number;
  roundsCompleted: number;
  partialRoundExerciseIndex: number | null;
  partialRoundReps: number | null;
}

export async function completeRoundsForTimeSession(sessionId: number, result: RftResult): Promise<void> {
  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .select("target_rounds, time_cap_seconds")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.target_rounds === null) throw new Error("session_not_found");

  const roundsCompleted = Math.min(result.roundsCompleted, session.target_rounds);
  const elapsedSeconds = session.time_cap_seconds !== null ? Math.min(result.elapsedSeconds, session.time_cap_seconds) : result.elapsedSeconds;

  const { error } = await admin
    .from("workout_sessions")
    .update({
      status: "completed",
      rounds_completed: roundsCompleted,
      elapsed_seconds: elapsedSeconds,
      partial_round_exercise_index: result.partialRoundExerciseIndex,
      partial_round_reps: result.partialRoundReps,
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

// HIIT completion (Stage 4, 2026-08-30) — nothing self-reported at all,
// unlike AMRAP's tally or RFT's stopwatch result: v1 has no early-exit
// path, so the member always completes every prescribed round, and the
// total duration is fully determined by the stored work/rest/rounds
// prescription. The server computes elapsedSeconds itself from that
// prescription plus the session's own exercise count — never trusts
// anything from the client (there's nothing for the client to submit),
// strictly more defensive than RFT's own clamp-against-stored-target.
export async function completeHiitSession(sessionId: number): Promise<void> {
  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .select("target_rounds, work_seconds, rest_seconds, rest_between_rounds_seconds")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.target_rounds === null || session.work_seconds === null) throw new Error("session_not_found");

  const { count: exerciseCount, error: countError } = await admin
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (countError) throw new Error(countError.message);

  const rounds = session.target_rounds;
  const n = exerciseCount ?? 0;
  const workSeconds = session.work_seconds;
  const restSeconds = session.rest_seconds ?? 0;
  const restBetweenRoundsSeconds = session.rest_between_rounds_seconds ?? 0;
  // Work→rest→work→...→work (no trailing rest within a round) per round,
  // plus rest-between-rounds after every round except the last — matches
  // the sequencer's own transition rules in workout-view.tsx.
  const elapsedSeconds = rounds * (n * workSeconds + Math.max(n - 1, 0) * restSeconds) + Math.max(rounds - 1, 0) * restBetweenRoundsSeconds;

  const { error } = await admin
    .from("workout_sessions")
    .update({
      status: "completed",
      rounds_completed: rounds,
      elapsed_seconds: elapsedSeconds,
    })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

// HIIT reps tally (2026-08-30, Carl's own follow-up: "would you not want
// to track how many of each you did in the 30s?"). Optional, logged
// AFTER completion (completeHiitSession already ran automatically —
// this never blocks or delays that) — one number per exercise, the
// member's own recollection of roughly how many reps they got per
// interval, not a per-round breakdown (too fine-grained to remember
// accurately, and every other self-reported number in this app — AMRAP's
// tally, RPE — is already a single post-hoc estimate, not a live count).
// Reuses workout_sets.reps_actual, the exact column every other format
// already writes real logged reps into — no new column needed. A member
// can leave any exercise blank; only the ones actually supplied are
// written. Ownership of each exerciseId is re-verified against this
// session, same never-trust-the-client-ids posture as swapExercise.
export async function logHiitReps(sessionId: number, reps: { exerciseId: number; reps: number }[]): Promise<void> {
  if (reps.length === 0) return;
  const admin = createAdminClient();

  const { data: exercises, error: exercisesError } = await admin.from("workout_exercises").select("id").eq("session_id", sessionId);
  if (exercisesError) throw new Error(exercisesError.message);
  const validExerciseIds = new Set((exercises ?? []).map((e) => e.id));

  for (const entry of reps) {
    if (!validExerciseIds.has(entry.exerciseId)) continue;
    const { error } = await admin
      .from("workout_sets")
      .update({ reps_actual: entry.reps })
      .eq("exercise_id", entry.exerciseId)
      .eq("set_number", 1);
    if (error) throw new Error(error.message);
  }
}

// Marks a session complete and previews the NEXT session's weights right
// away, using today's just-logged RPE — the brief's "AI Coach next session
// preview: what's next and why weights changed" (§9 Post-Session Summary).
// Genuinely re-runs the deterministic engine rather than guessing at the
// direction of change.
export async function completeSession(
  sessionId: number,
  memberId: number,
  memberName: string
): Promise<{ totalVolumeKg: number; changes: WeightChangePreview[]; narration: string | null }> {
  const admin = createAdminClient();

  const detail = await loadSessionDetail(sessionId);
  const totalVolumeKg = detail.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.repsActual ?? 0) * (set.weightActualKg ?? 0), 0),
    0
  );

  await admin.from("workout_sessions").update({ status: "completed" }).eq("id", sessionId);

  const profile = await getCoachProfile(memberId);
  if (!profile) {
    return { totalVolumeKg, changes: [], narration: null };
  }

  const { history, lastSession } = await getWorkoutHistory(memberId);
  const activeBlock = await resolveActiveBlock(memberId, profile);
  // Same template-if-available, generate-fresh-otherwise resolution as
  // getOrCreateWorkoutSession — the preview should show what the next
  // *actual* session will contain, not a plan generated a different way
  // than what getOrCreateWorkoutSession will really produce next time.
  const templated = await resolveTemplatedPlan(memberId, profile, history, activeBlock, []);
  const nextPlan = templated?.plan ?? generateWorkout({ profile, history, lastSession, activeBlock });

  const changes: WeightChangePreview[] = nextPlan
    .map((next) => {
      const current = detail.exercises.find((e) => e.key === next.key);
      const lastSet = current?.sets.filter((s) => s.completedAt).slice(-1)[0];
      // Either side being null (the just-completed set was itself a
      // first-timer with a blank target, or next session's plan somehow
      // lands on an exercise with no history yet) means there's nothing
      // meaningful to show as "changed from" — skip rather than display
      // a broken/blank comparison.
      if (!current || !lastSet || lastSet.weightTargetKg === null || next.weightTargetKg === null) return null;
      return { name: next.name, oldWeightKg: lastSet.weightTargetKg, newWeightKg: next.weightTargetKg, lastRpe: lastSet.rpe };
    })
    .filter((c): c is WeightChangePreview => c !== null && c.oldWeightKg !== c.newWeightKg);

  let narration: string | null = null;
  if (changes.length > 0) {
    try {
      narration = await narratePostSession(memberName, changes);
    } catch (error) {
      console.error("[workout] post-session narration failed", { error: (error as Error).message });
    }
  }

  return { totalVolumeKg, changes, narration };
}

export interface SessionHistoryEntry {
  sessionId: number;
  createdAt: string;
  format: WorkoutFormat;
  muscleGroups: string[];
  totalVolumeKg: number;
  roundsCompleted: number | null;
  elapsedSeconds: number | null;
  targetRounds: number | null;
}

// Session-history list (2026-08-30) — was getRecentCompletedSessions,
// built for the Coach hub's "Recent workouts" list but never actually
// wired up anywhere (confirmed zero callers) and format-unaware (volume
// is 0 and muscleGroups is meaningless for every circuit-format session,
// since those never log reps_actual/weight_actual_kg the normal way).
// Fixed and renamed for /training/history's own list, which needs the
// circuit result fields (roundsCompleted/elapsedSeconds/targetRounds) to
// show a real headline stat per row instead of a straight-sets-only
// volume figure. Same on-the-fly volume calculation completeSession()
// uses, no persisted stats column needed. Batches exercises/sets across
// all returned sessions in two queries rather than one round-trip per
// session.
export async function getSessionHistory(memberId: number, limit = 20): Promise<SessionHistoryEntry[]> {
  const admin = createAdminClient();

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id, created_at, format, rounds_completed, elapsed_seconds, target_rounds")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, session_id, muscle_group")
    .in("session_id", sessionIds);
  if (exercisesError) throw new Error(exercisesError.message);

  const exerciseIds = (exercises ?? []).map((e) => e.id);
  const { data: sets, error: setsError } =
    exerciseIds.length > 0
      ? await admin.from("workout_sets").select("exercise_id, reps_actual, weight_actual_kg").in("exercise_id", exerciseIds)
      : { data: [], error: null };
  if (setsError) throw new Error(setsError.message);

  return sessions.map((session) => {
    const sessionExerciseIds = new Set((exercises ?? []).filter((e) => e.session_id === session.id).map((e) => e.id));
    const muscleGroups = [
      ...new Set((exercises ?? []).filter((e) => e.session_id === session.id).map((e) => e.muscle_group)),
    ];
    const totalVolumeKg = (sets ?? [])
      .filter((s) => sessionExerciseIds.has(s.exercise_id))
      .reduce((sum, s) => sum + (s.reps_actual ?? 0) * (s.weight_actual_kg ?? 0), 0);
    return {
      sessionId: session.id,
      createdAt: session.created_at,
      format: session.format as WorkoutFormat,
      muscleGroups,
      totalVolumeKg,
      roundsCompleted: session.rounds_completed,
      elapsedSeconds: session.elapsed_seconds,
      targetRounds: session.target_rounds,
    };
  });
}

const STATS_WEEKS_WINDOW = 26;

export interface LifetimeWorkoutStats {
  totalSessions: number;
  totalVolumeKg: number;
  byFormat: Record<WorkoutFormat, number>;
}

// Stats summary at the top of /training/history (2026-08-30) — "last 26
// weeks", not unbounded lifetime: matches the WEEKS_WINDOW convention
// every other aggregate function in this codebase already uses
// (consistency.ts, exercise-performance.ts, body-measurements.ts), and
// sidesteps needing unbounded .range() pagination past PostgREST's
// 1000-row cap for a long-tenured member — see CLAUDE.md's own Data
// pipeline note on that cap (written about the podHq admin app's tables,
// but the same PostgREST behaviour applies to this Supabase project's
// workout_sessions too). One query for the window is well within that
// cap for any realistic training frequency.
export async function getLifetimeWorkoutStats(memberId: number): Promise<LifetimeWorkoutStats> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - STATS_WEEKS_WINDOW * 7 * 24 * 60 * 60 * 1000);

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id, format")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .gte("created_at", since.toISOString());
  if (sessionsError) throw new Error(sessionsError.message);

  const byFormat: Record<WorkoutFormat, number> = { straight_sets: 0, amrap: 0, rounds_for_time: 0, hiit: 0 };
  for (const session of sessions ?? []) {
    const format = session.format as WorkoutFormat;
    byFormat[format] = (byFormat[format] ?? 0) + 1;
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  let totalVolumeKg = 0;
  if (sessionIds.length > 0) {
    const { data: exercises, error: exercisesError } = await admin.from("workout_exercises").select("id").in("session_id", sessionIds);
    if (exercisesError) throw new Error(exercisesError.message);
    const exerciseIds = (exercises ?? []).map((e) => e.id);
    if (exerciseIds.length > 0) {
      const { data: sets, error: setsError } = await admin.from("workout_sets").select("reps_actual, weight_actual_kg").in("exercise_id", exerciseIds);
      if (setsError) throw new Error(setsError.message);
      totalVolumeKg = (sets ?? []).reduce((sum, s) => sum + (s.reps_actual ?? 0) * (s.weight_actual_kg ?? 0), 0);
    }
  }

  return { totalSessions: (sessions ?? []).length, totalVolumeKg, byFormat };
}
