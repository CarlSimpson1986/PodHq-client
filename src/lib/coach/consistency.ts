import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonMidnight } from "@/lib/london-time";

export interface WeeklyConsistency {
  weeksAgo: number; // 0 = this week, ascending = further back
  sessionsCompleted: number;
}

const WEEKS_WINDOW = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Sessions completed per week, last 8 weeks — the plain "did they
// actually show up" signal, compared against coach_profiles.sessions_per_week
// (their own goal) in the UI. Same London-midnight day-bucketing as
// exercise-performance.ts, same reasoning: consistent week assignment
// regardless of time-of-day/DST at the boundary.
export async function getWeeklyConsistency(memberId: number): Promise<WeeklyConsistency[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WEEKS_WINDOW * 7 * MS_PER_DAY);

  const { data: sessions, error } = await admin
    .from("workout_sessions")
    .select("created_at")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .gte("created_at", since.toISOString());
  if (error) throw new Error(error.message);

  const nowMidnight = londonMidnight(new Date()).getTime();
  const countByWeek = new Map<number, number>();
  for (let i = 0; i < WEEKS_WINDOW; i++) countByWeek.set(i, 0);

  for (const session of sessions ?? []) {
    const sessionMidnight = londonMidnight(new Date(session.created_at)).getTime();
    const daysAgo = Math.round((nowMidnight - sessionMidnight) / MS_PER_DAY);
    const weeksAgo = Math.min(WEEKS_WINDOW - 1, Math.floor(daysAgo / 7));
    countByWeek.set(weeksAgo, (countByWeek.get(weeksAgo) ?? 0) + 1);
  }

  return [...countByWeek.entries()]
    .map(([weeksAgo, sessionsCompleted]) => ({ weeksAgo, sessionsCompleted }))
    .sort((a, b) => b.weeksAgo - a.weeksAgo);
}
