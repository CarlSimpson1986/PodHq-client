import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonMidnight } from "@/lib/london-time";

export interface ExerciseWeeklyPerformance {
  exerciseKey: string;
  exerciseName: string;
  // weeksAgo 0 = this week, ascending = further back. Sparse — only
  // weeks the exercise was actually trained appear.
  weeks: { weeksAgo: number; maxWeightKg: number }[];
}

const WEEKS_WINDOW = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Per-exercise, week-by-week peak weight lifted — the most direct visual
// signal of progressive overload, the same thing generate-workout.ts's
// RPE-driven adjustments are already optimising for session to session.
// Follows getRecentCompletedSessions's batching shape (sessions, then
// exercises, then sets — three queries regardless of history size, not
// one per session). Day-bucketing goes through londonMidnight (same
// pattern as checkin-state.ts's daysBetweenMidnights) so a late-Sunday-
// night session lands in a consistent week bucket regardless of
// time-of-day or DST, matching this app's established london-time.ts
// convention for anything date-bucketed.
export async function getExercisePerformanceHistory(memberId: number): Promise<ExerciseWeeklyPerformance[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WEEKS_WINDOW * 7 * MS_PER_DAY);

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id, created_at")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .gte("created_at", since.toISOString());
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, session_id, exercise_key, name")
    .in("session_id", sessionIds);
  if (exercisesError) throw new Error(exercisesError.message);
  if (!exercises || exercises.length === 0) return [];

  const exerciseIds = exercises.map((e) => e.id);
  const { data: sets, error: setsError } = await admin
    .from("workout_sets")
    .select("exercise_id, weight_actual_kg")
    .in("exercise_id", exerciseIds)
    .not("weight_actual_kg", "is", null);
  if (setsError) throw new Error(setsError.message);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const nowMidnight = londonMidnight(new Date()).getTime();

  const byExercise = new Map<string, { name: string; weeks: Map<number, number> }>();

  for (const set of sets ?? []) {
    if (set.weight_actual_kg === null) continue;
    const exercise = exerciseById.get(set.exercise_id);
    if (!exercise) continue;
    const session = sessionById.get(exercise.session_id);
    if (!session) continue;

    const sessionMidnight = londonMidnight(new Date(session.created_at)).getTime();
    const daysAgo = Math.round((nowMidnight - sessionMidnight) / MS_PER_DAY);
    const weeksAgo = Math.min(WEEKS_WINDOW - 1, Math.floor(daysAgo / 7));

    if (!byExercise.has(exercise.exercise_key)) {
      byExercise.set(exercise.exercise_key, { name: exercise.name, weeks: new Map() });
    }
    const entry = byExercise.get(exercise.exercise_key)!;
    const currentMax = entry.weeks.get(weeksAgo) ?? 0;
    if (set.weight_actual_kg > currentMax) {
      entry.weeks.set(weeksAgo, set.weight_actual_kg);
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseKey, { name, weeks }]) => ({
      exerciseKey,
      exerciseName: name,
      weeks: [...weeks.entries()]
        .map(([weeksAgo, maxWeightKg]) => ({ weeksAgo, maxWeightKg }))
        .sort((a, b) => b.weeksAgo - a.weeksAgo),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export interface LastSessionSet {
  setNumber: number;
  weightActualKg: number | null;
  repsActual: number | null;
  // 1-5, see RPE_SCALE in types.ts — null if the member didn't rate that set.
  rpe: number | null;
  // Prescription, not result — a circuit format (AMRAP/RFT) never logs
  // per-set actuals (weightActualKg/repsActual/rpe above stay null for
  // those), so this is what the card falls back to for its round preview.
  repsTarget: number | null;
  weightTargetKg: number | null;
}

export interface LastSessionExercise {
  exerciseKey: string;
  name: string;
  muscleGroup: string;
  sets: LastSessionSet[];
}

// Cardio-format result fields (2026-08-30 — LastSessionCard was built
// straight-sets-only, before AMRAP/RFT sessions could actually complete;
// without these a completed circuit session rendered as a wall of "Not
// rated" badges with no weight, silently losing the one thing that
// actually matters for it: the rounds/time result). Mirrors
// WorkoutSessionDetail's own shape in workout-session.ts.
export type LastSessionFormat = "straight_sets" | "amrap" | "rounds_for_time";

export interface LastSessionDetail {
  sessionId: number;
  createdAt: string;
  format: LastSessionFormat;
  timeCapSeconds: number | null;
  roundsCompleted: number | null;
  targetRounds: number | null;
  elapsedSeconds: number | null;
  partialRoundExerciseIndex: number | null;
  partialRoundReps: number | null;
  exercises: LastSessionExercise[];
}

// The most recently completed session, exercises + sets + per-set RPE —
// didn't exist before the 2026-08-25 redesign (getRecentCompletedSessions
// in workout-session.ts only returns muscle groups + total volume, no
// per-set detail, even though workout_sets.rpe is a real column). Same
// three-query batching shape as getWorkoutHistory/getExercisePerformanceHistory.
export async function getLastCompletedSessionDetail(memberId: number): Promise<LastSessionDetail | null> {
  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("workout_sessions")
    .select("id, created_at, format, time_cap_seconds, rounds_completed, target_rounds, elapsed_seconds, partial_round_exercise_index, partial_round_reps")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;

  const base = {
    sessionId: session.id,
    createdAt: session.created_at,
    format: session.format as LastSessionFormat,
    timeCapSeconds: session.time_cap_seconds,
    roundsCompleted: session.rounds_completed,
    targetRounds: session.target_rounds,
    elapsedSeconds: session.elapsed_seconds,
    partialRoundExerciseIndex: session.partial_round_exercise_index,
    partialRoundReps: session.partial_round_reps,
  };

  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, exercise_key, name, muscle_group, sort_order")
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });
  if (exercisesError) throw new Error(exercisesError.message);
  if (!exercises || exercises.length === 0) {
    return { ...base, exercises: [] };
  }

  const exerciseIds = exercises.map((e) => e.id);
  const { data: sets, error: setsError } = await admin
    .from("workout_sets")
    .select("exercise_id, set_number, weight_actual_kg, reps_actual, rpe, reps_target, weight_target_kg")
    .in("exercise_id", exerciseIds)
    .order("set_number", { ascending: true });
  if (setsError) throw new Error(setsError.message);

  const setsByExercise = new Map<number, LastSessionSet[]>();
  for (const set of sets ?? []) {
    const list = setsByExercise.get(set.exercise_id) ?? [];
    list.push({
      setNumber: set.set_number,
      weightActualKg: set.weight_actual_kg,
      repsActual: set.reps_actual,
      rpe: set.rpe,
      repsTarget: set.reps_target,
      weightTargetKg: set.weight_target_kg,
    });
    setsByExercise.set(set.exercise_id, list);
  }

  return {
    ...base,
    exercises: exercises.map((e) => ({
      exerciseKey: e.exercise_key,
      name: e.name,
      muscleGroup: e.muscle_group,
      sets: setsByExercise.get(e.id) ?? [],
    })),
  };
}
