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

// No "pending" row concept — a check-in is only ever inserted once
// actually completed, same convention as food_log_entries/habit_logs.
// `answers` is empty until Stage 10b's honestly-stubbed Q&A becomes the
// real thing (Carl's own call to make later).
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
