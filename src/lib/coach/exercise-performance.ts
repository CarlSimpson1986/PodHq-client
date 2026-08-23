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
