import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachProfile, getWorkoutHistory, type CoachProfile } from "@/lib/coach/coach-profile";
import {
  generateWorkout,
  getInjuryExcludedKeys,
  computeWeightKgForBlock,
  type GeneratedExercise,
} from "@/lib/coach/generate-workout";
import { EXERCISE_CATALOG } from "@/lib/coach/exercise-catalog";
import { narrateSessionIntro, narratePostSession } from "@/lib/coach-bot";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getActiveBlock } from "@/lib/coach/training-block-state";
import type { BlockType } from "@/lib/coach/types";

export interface WorkoutSet {
  id: number;
  setNumber: number;
  repsTarget: number;
  weightTargetKg: number;
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
  sets: WorkoutSet[];
}

// What loadSessionDetail alone can produce — it has no coach-profile
// access, so it can't compute excludedExerciseKeys itself. Callers that
// have (or can cheaply get) the member's profile attach that field on
// top; see WorkoutSessionDetail.
interface SessionExerciseDetail {
  sessionId: number;
  status: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutSessionDetail extends SessionExerciseDetail {
  // Catalog keys the member's stated injuries exclude — same set
  // generation itself filters against (getInjuryExcludedKeys). Lets the
  // client build a safe exercise-swap candidate list without a second
  // round trip, while the actual swap is still independently
  // re-validated server-side.
  excludedExerciseKeys: string[];
}

// Stage 12c real risk: the safe fallback on any error resolving the
// active block is undefined (today's already-safety-reviewed goal-based
// generation), never a hardcoded block type — a caught error must never
// silently produce e.g. "strength".
async function resolveActiveBlock(memberId: number, coachProfile: CoachProfile): Promise<{ blockType: BlockType } | undefined> {
  try {
    const blockHistory = await getBlockHistory(memberId);
    const active = getActiveBlock(coachProfile, blockHistory);
    return { blockType: active.blockType };
  } catch (error) {
    console.error("[workout] failed to resolve active training block, falling back to goal-based generation", {
      error: (error as Error).message,
    });
    return undefined;
  }
}

// Fetches an existing workout_session (with exercises/sets) for a booking,
// or generates + persists a new one. Idempotent on booking_id's unique
// index — a member re-opening the same booked session's workout screen
// must see the same plan, not a freshly regenerated one.
export async function getOrCreateWorkoutSession(
  memberId: number,
  bookingId: number,
  resourceId: number,
  memberName: string
): Promise<{ detail: WorkoutSessionDetail; introNarration: string | null }> {
  const admin = createAdminClient();

  const { data: existing } = await admin.from("workout_sessions").select("id, status").eq("booking_id", bookingId).maybeSingle();

  if (existing) {
    // Doesn't require a coach profile here (unlike the fresh-generation
    // path below) — an already-generated session must still load even if
    // something odd happened to the profile afterward; a missing profile
    // just means no exclusion data to offer for swapping.
    const existingProfile = await getCoachProfile(memberId);
    const detail = await loadSessionDetail(existing.id);
    return {
      detail: { ...detail, excludedExerciseKeys: getInjuryExcludedKeys(existingProfile?.injuries ?? null) },
      introNarration: null,
    };
  }

  const profile = await getCoachProfile(memberId);
  if (!profile) {
    throw new Error("coach_profile_missing");
  }

  const { history, lastSession } = await getWorkoutHistory(memberId);
  const activeBlock = await resolveActiveBlock(memberId, profile);
  const plan = generateWorkout({ profile, history, lastSession, activeBlock });

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .insert({ member_id: memberId, booking_id: bookingId, resource_id: resourceId, status: "generated" })
    .select("id")
    .single();
  if (sessionError) throw new Error(sessionError.message);

  await insertExercisesAndSets(session.id, plan);

  let introNarration: string | null = null;
  try {
    introNarration = await narrateSessionIntro(memberName, plan);
  } catch (error) {
    // Narration is presentation-only — a Groq/Claude hiccup must not block
    // a member from seeing their (already-generated, already-saved) plan.
    console.error("[workout] narration failed", { error: (error as Error).message });
  }

  const detail = await loadSessionDetail(session.id);
  return { detail: { ...detail, excludedExerciseKeys: getInjuryExcludedKeys(profile.injuries) }, introNarration };
}

async function insertExercisesAndSets(sessionId: number, plan: GeneratedExercise[]): Promise<void> {
  const admin = createAdminClient();

  for (let i = 0; i < plan.length; i++) {
    const exercise = plan[i];
    const { data: exerciseRow, error: exerciseError } = await admin
      .from("workout_exercises")
      .insert({ session_id: sessionId, exercise_key: exercise.key, name: exercise.name, muscle_group: exercise.muscleGroup, sort_order: i })
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

  const { data: session, error: sessionError } = await admin.from("workout_sessions").select("id, status").eq("id", sessionId).single();
  if (sessionError) throw new Error(sessionError.message);

  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, exercise_key, name, muscle_group, sort_order")
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
    exercises: (exercises ?? []).map((e) => ({
      id: e.id,
      key: e.exercise_key,
      name: e.name,
      muscleGroup: e.muscle_group,
      sets: (sets ?? [])
        .filter((s) => s.exercise_id === e.id)
        .map((s) => ({
          id: s.id,
          setNumber: s.set_number,
          repsTarget: s.reps_target,
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

  const excludedKeys = getInjuryExcludedKeys(profile.injuries);
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
  return { ...updated, excludedExerciseKeys: excludedKeys };
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
  const nextPlan = generateWorkout({ profile, history, lastSession, activeBlock });

  const changes: WeightChangePreview[] = nextPlan
    .map((next) => {
      const current = detail.exercises.find((e) => e.key === next.key);
      const lastSet = current?.sets.filter((s) => s.completedAt).slice(-1)[0];
      if (!current || !lastSet) return null;
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

export interface RecentSessionSummary {
  sessionId: number;
  createdAt: string;
  muscleGroups: string[];
  totalVolumeKg: number;
}

// For the Coach hub's "Recent workouts" list — same on-the-fly volume
// calculation completeSession() uses, no persisted stats column needed.
// Batches exercises/sets across all returned sessions in two queries
// rather than one round-trip per session.
export async function getRecentCompletedSessions(memberId: number, limit = 5): Promise<RecentSessionSummary[]> {
  const admin = createAdminClient();

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id, created_at")
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
    return { sessionId: session.id, createdAt: session.created_at, muscleGroups, totalVolumeKg };
  });
}
