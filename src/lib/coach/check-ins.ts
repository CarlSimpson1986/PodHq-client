import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getLastCheckIn(memberId: number): Promise<{ completedAt: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("check_ins")
    .select("completed_at")
    .eq("member_id", memberId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? { completedAt: data.completed_at } : null;
}

export interface RecentCheckIn {
  periodStart: string;
  habit: string | null;
}

// Feeds computeHabitStreak (habit-streak.ts) and the current "Your
// habit" card — ordered period_start descending so the caller can walk
// back from most recent without re-sorting. 26 weeks (half a year) is
// comfortably past any real streak this brand-new feature could have
// yet, while keeping the query bounded as check-in history grows.
export async function getRecentCheckIns(memberId: number, limit = 26): Promise<RecentCheckIn[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("check_ins")
    .select("period_start, answers")
    .eq("member_id", memberId)
    .order("period_start", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const raw = (row.answers as Record<string, unknown> | null)?.habit;
    const habit = typeof raw === "string" && raw.trim().length > 0 ? raw : null;
    return { periodStart: row.period_start, habit };
  });
}

// No "pending" row concept — a check-in is only ever inserted once
// actually completed, same convention as food_log_entries/habit_logs.
export async function completeCheckIn(
  memberId: number,
  periodStart: string,
  periodEnd: string,
  answers: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("check_ins").insert({
    member_id: memberId,
    period_start: periodStart,
    period_end: periodEnd,
    answers,
  });
  if (error) throw new Error(error.message);
}
