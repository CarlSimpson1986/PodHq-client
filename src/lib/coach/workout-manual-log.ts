import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonDateString } from "@/lib/london-time";

export async function isWorkoutManuallyLoggedToday(
  memberId: number,
  date: string = londonDateString(new Date())
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_workout_manual_logs")
    .select("id")
    .eq("member_id", memberId)
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

// (member_id, log_date) is unique, so a duplicate tap is a harmless
// no-op rather than an error — same idempotency posture as habit_logs.
export async function logWorkoutManually(memberId: number, date: string = londonDateString(new Date())): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("member_workout_manual_logs")
    .upsert({ member_id: memberId, log_date: date }, { onConflict: "member_id,log_date", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

// Same-day-only undo, mirrors habit_logs' deliberate exception — deletes
// the row rather than storing a done/undone flag (see migration comment).
export async function undoWorkoutManualLogToday(memberId: number, date: string = londonDateString(new Date())): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_workout_manual_logs").delete().eq("member_id", memberId).eq("log_date", date);
  if (error) throw new Error(error.message);
}
