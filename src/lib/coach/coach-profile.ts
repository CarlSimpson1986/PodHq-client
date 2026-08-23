import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Goal, ExperienceLevel } from "@/lib/coach/types";

export interface CoachProfile {
  id: number;
  member_id: number;
  goal: Goal;
  experience_level: ExperienceLevel;
  injuries: string | null;
  sessions_per_week: number;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
}

// Same session-verified-first, admin-client-second pattern as every other
// data-access function in this app — see member.ts's own comment on why
// RLS's auth.uid() is never the actual authorization check.
export async function getCoachProfile(memberId: number): Promise<CoachProfile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("coach_profiles").select("*").eq("member_id", memberId).maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export interface ExerciseHistoryEntry {
  exerciseKey: string;
  lastWeightKg: number;
  lastRpe: number | null;
}

export interface RecentSessionSummary {
  muscleGroups: string[];
}

// Pulls just enough from the last few workout_sessions to drive
// generate-workout.ts: the most recent weight/RPE per exercise (for
// progressive overload) and the immediately preceding session's muscle
// groups (for rotation). Not a full session history read — this app
// never needs more than that for generation.
export async function getWorkoutHistory(
  memberId: number,
  limit = 6
): Promise<{ history: ExerciseHistoryEntry[]; lastSession: RecentSessionSummary | null }> {
  const admin = createAdminClient();

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return { history: [], lastSession: null };

  const sessionIds = sessions.map((s) => s.id);
  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id, session_id, exercise_key, muscle_group")
    .in("session_id", sessionIds);

  if (exercisesError) throw new Error(exercisesError.message);
  if (!exercises || exercises.length === 0) return { history: [], lastSession: null };

  const exerciseIds = exercises.map((e) => e.id);
  const { data: sets, error: setsError } = await admin
    .from("workout_sets")
    .select("exercise_id, weight_target_kg, rpe, completed_at")
    .in("exercise_id", exerciseIds)
    .not("completed_at", "is", null);

  if (setsError) throw new Error(setsError.message);

  // Most recent completed set per exercise_key. sessionOrder ranks
  // sessions[0] (newest, since sessions is ordered descending by
  // created_at) as 0 — lower rank wins. Tracked in a parallel map since
  // ExerciseHistoryEntry itself doesn't carry a rank.
  const sessionOrder = new Map(sessions.map((s, i) => [s.id, i]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const latestByKey = new Map<string, ExerciseHistoryEntry>();
  const bestRankByKey = new Map<string, number>();

  for (const set of sets ?? []) {
    const exercise = exerciseById.get(set.exercise_id);
    if (!exercise) continue;
    const thisRank = sessionOrder.get(exercise.session_id) ?? Infinity;
    const bestRank = bestRankByKey.get(exercise.exercise_key) ?? Infinity;
    if (thisRank < bestRank) {
      bestRankByKey.set(exercise.exercise_key, thisRank);
      latestByKey.set(exercise.exercise_key, {
        exerciseKey: exercise.exercise_key,
        lastWeightKg: set.weight_target_kg,
        lastRpe: set.rpe,
      });
    }
  }

  const mostRecentSessionId = sessions[0].id;
  const lastSessionMuscleGroups = [
    ...new Set(exercises.filter((e) => e.session_id === mostRecentSessionId).map((e) => e.muscle_group)),
  ];

  return {
    history: [...latestByKey.values()],
    lastSession: lastSessionMuscleGroups.length > 0 ? { muscleGroups: lastSessionMuscleGroups } : null,
  };
}
