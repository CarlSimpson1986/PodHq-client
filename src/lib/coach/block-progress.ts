import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// How many of the block's most recent logged RPE values feed the
// deload→strength fatigue gate — enough to be a real signal without
// growing unbounded across a 12-week block.
const RECENT_RPE_SAMPLE_SIZE = 20;

export interface BlockProgress {
  completedSessions: number;
  weeksElapsed: number;
  recentRpe: number[];
}

// Real risk flagged in the Stage 12 plan: the gate's attendance/RPE query
// must filter by the CURRENT block's start, not the member's whole
// history — same boundary precision the RPE tiebreaker and check-in
// period logic already had to get right once. Mirrors
// getRecentCompletedSessions's two-query batching shape, date-windowed
// from blockStartedAt instead of limit-windowed.
export async function getBlockProgress(memberId: number, blockStartedAt: string, now: Date): Promise<BlockProgress> {
  const admin = createAdminClient();

  const { data: sessions, error: sessionsError } = await admin
    .from("workout_sessions")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .gte("created_at", blockStartedAt)
    .lte("created_at", now.toISOString());
  if (sessionsError) throw new Error(sessionsError.message);

  const daysElapsed = (now.getTime() - new Date(blockStartedAt).getTime()) / MS_PER_DAY;
  const weeksElapsed = Math.floor(Math.max(0, daysElapsed) / 7);

  const completedSessions = sessions?.length ?? 0;
  if (completedSessions === 0) {
    return { completedSessions: 0, weeksElapsed, recentRpe: [] };
  }

  const sessionIds = sessions!.map((s) => s.id);
  const { data: exercises, error: exercisesError } = await admin
    .from("workout_exercises")
    .select("id")
    .in("session_id", sessionIds);
  if (exercisesError) throw new Error(exercisesError.message);

  const exerciseIds = (exercises ?? []).map((e) => e.id);
  if (exerciseIds.length === 0) {
    return { completedSessions, weeksElapsed, recentRpe: [] };
  }

  const { data: sets, error: setsError } = await admin
    .from("workout_sets")
    .select("rpe, completed_at")
    .in("exercise_id", exerciseIds)
    .not("rpe", "is", null)
    .order("completed_at", { ascending: false })
    .limit(RECENT_RPE_SAMPLE_SIZE);
  if (setsError) throw new Error(setsError.message);

  const recentRpe = (sets ?? []).map((s) => s.rpe as number);
  return { completedSessions, weeksElapsed, recentRpe };
}
