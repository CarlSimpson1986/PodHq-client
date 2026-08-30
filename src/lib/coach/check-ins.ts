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

export interface LatestPainReport {
  hadPain: boolean;
  // "" is treated the same as never having been given — a member can tap
  // "Yes" and leave the detail blank (checkin-view.tsx's painDetail is
  // optional even when hadPain is true).
  painDetail: string | null;
}

// Feeds getPainCaution (pain-caution.ts) — the check-in's "any pain or
// discomfort" question used to be stored and never read again anywhere
// (coaching review, 2026-08-30). This is always just the LATEST check-in,
// which is what makes the caution self-expiring: once a member reports no
// pain (or simply completes a newer check-in), whatever this returns
// updates automatically — nothing to manually clear.
export async function getLatestPainReport(memberId: number): Promise<LatestPainReport | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("check_ins")
    .select("answers")
    .eq("member_id", memberId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const answers = data.answers as Record<string, unknown> | null;
  const hadPain = answers?.hadPain === true;
  const rawDetail = answers?.painDetail;
  const painDetail = typeof rawDetail === "string" && rawDetail.trim().length > 0 ? rawDetail : null;
  return { hadPain, painDetail };
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
