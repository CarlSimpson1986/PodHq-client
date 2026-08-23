import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachProfile, getWorkoutHistory } from "@/lib/coach/coach-profile";
import { generateWorkout, type GeneratedExercise } from "@/lib/coach/generate-workout";
import { narrateSessionIntro, narratePostSession } from "@/lib/coach-bot";

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

export interface WorkoutSessionDetail {
  sessionId: number;
  status: string;
  exercises: WorkoutExercise[];
}

const SETS_PER_EXERCISE = 3;

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
    return { detail: await loadSessionDetail(existing.id), introNarration: null };
  }

  const profile = await getCoachProfile(memberId);
  if (!profile) {
    throw new Error("coach_profile_missing");
  }

  const { history, lastSession } = await getWorkoutHistory(memberId);
  const plan = generateWorkout({ profile, history, lastSession });

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

  return { detail: await loadSessionDetail(session.id), introNarration };
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

    const setsToInsert = Array.from({ length: SETS_PER_EXERCISE }).map((_, setIndex) => ({
      exercise_id: exerciseRow.id,
      set_number: setIndex + 1,
      reps_target: exercise.repsTarget,
      weight_target_kg: exercise.weightTargetKg,
    }));
    const { error: setsError } = await admin.from("workout_sets").insert(setsToInsert);
    if (setsError) throw new Error(setsError.message);
  }
}

export async function loadSessionDetail(sessionId: number): Promise<WorkoutSessionDetail> {
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
  const nextPlan = generateWorkout({ profile, history, lastSession });

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
