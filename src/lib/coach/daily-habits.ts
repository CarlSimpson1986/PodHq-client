import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonDateString } from "@/lib/london-time";
import type { HabitType } from "@/lib/coach/types";

export interface MemberHabit {
  id: number;
  name: string;
  habitType: HabitType;
  targetCount: number | null;
  unit: string | null;
}

export async function getActiveHabits(memberId: number): Promise<MemberHabit[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_habits")
    .select("id, name, habit_type, target_count, unit")
    .eq("member_id", memberId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    habitType: row.habit_type as HabitType,
    targetCount: row.target_count,
    unit: row.unit,
  }));
}

export interface AddHabitInput {
  name: string;
  habitType: HabitType;
  targetCount: number | null;
  unit: string | null;
}

export async function addHabit(memberId: number, input: AddHabitInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_habits").insert({
    member_id: memberId,
    name: input.name,
    habit_type: input.habitType,
    target_count: input.habitType === "counted" ? input.targetCount : null,
    unit: input.habitType === "counted" ? input.unit : null,
  });
  if (error) throw new Error(error.message);
}

// IDOR guard shared by archive/tick/untick — never trust a client-supplied
// habit id alone, same pattern as getFoodLogEntryOwnerMemberId.
export async function getHabitOwnerMemberId(habitId: number): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("member_habits").select("member_id").eq("id", habitId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.member_id ?? null;
}

export async function archiveHabit(habitId: number): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("member_habits").update({ archived_at: new Date().toISOString() }).eq("id", habitId);
  if (error) throw new Error(error.message);
}

// Today's tick count per habit — a checkbox habit is "done" once this is
// >= 1, a counted habit's progress is this number against its
// targetCount. Counting habit_logs rows directly rather than a stored
// running total, so there's never an update statement to keep in sync
// (see the migration's own comment).
export async function getTodayProgress(memberId: number, date: string = londonDateString(new Date())): Promise<Map<number, number>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("habit_logs").select("habit_id").eq("member_id", memberId).eq("log_date", date);
  if (error) throw new Error(error.message);

  const progress = new Map<number, number>();
  for (const row of data ?? []) {
    progress.set(row.habit_id, (progress.get(row.habit_id) ?? 0) + 1);
  }
  return progress;
}

// Inserts one tick — for a checkbox habit the caller (the API route)
// checks today's progress first and only calls this when it's still 0,
// same "check then insert" idempotency as elsewhere in this app; for a
// counted habit every tap is a genuine new tick, no cap enforced here
// (a member ticking past their target just means they exceeded it, not
// an error).
export async function logHabitTick(memberId: number, habitId: number, date: string = londonDateString(new Date())): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("habit_logs").insert({ habit_id: habitId, member_id: memberId, log_date: date });
  if (error) throw new Error(error.message);
}

// The one deliberate exception to this feature's insert-only convention
// (see migration comment) — undoes a same-day mis-tap by deleting the
// single most recent tick for today, never a past day's. Returns false
// (not an error) when there's nothing to undo, so the route can give an
// honest "nothing to undo" response instead of silently no-op'ing.
export async function undoLastTickToday(memberId: number, habitId: number, date: string = londonDateString(new Date())): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("habit_logs")
    .select("id")
    .eq("member_id", memberId)
    .eq("habit_id", habitId)
    .eq("log_date", date)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return false;

  const { error: deleteError } = await admin.from("habit_logs").delete().eq("id", data[0].id);
  if (deleteError) throw new Error(deleteError.message);
  return true;
}
