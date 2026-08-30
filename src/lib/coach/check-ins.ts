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

export interface LatestCheckInResponse {
  narrative: string | null;
  painAcknowledgment: string | null;
}

// Home dashboard, 2026-08-30 — the coach's response used to be shown once
// on the check-in completion screen and then genuinely gone: /complete
// returned it but never saved it, so navigating away lost it for good.
// It's now persisted alongside the answers that produced it (see
// /complete's own comment) — this reads it back for CoachResponseCard.
// Same self-expiring shape as getLatestPainReport above: always just the
// latest check-in, so it updates on its own each week with nothing to
// manually clear.
export async function getLatestCheckInResponse(memberId: number): Promise<LatestCheckInResponse | null> {
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
  const rawNarrative = answers?.narrative;
  const rawPainAck = answers?.painAcknowledgment;
  const narrative = typeof rawNarrative === "string" && rawNarrative.trim().length > 0 ? rawNarrative : null;
  const painAcknowledgment = typeof rawPainAck === "string" && rawPainAck.trim().length > 0 ? rawPainAck : null;
  return { narrative, painAcknowledgment };
}

export interface RecentCheckIn {
  periodStart: string;
  habit: string | null;
  // habitFollowUp/weekFeel (2026-08-30) — feed habit-follow-through.ts and
  // mood-trend.ts respectively. Both null on a check-in that predates
  // these questions (weekFeel: shouldn't happen, it's always been
  // required) or, for habitFollowUp specifically, a member's first-ever
  // check-in (nothing to follow up on yet — see getPreviousHabit).
  habitFollowUp: "yes" | "partially" | "no" | null;
  weekFeel: number | null;
}

// Feeds computeHabitStreak (habit-streak.ts) and the current "Your
// habit" card — ordered period_start descending so the caller can walk
// back from most recent without re-sorting. 26 weeks (half a year) is
// comfortably past any real streak this brand-new feature could have
// yet, while keeping the query bounded as check-in history grows.
// Ordering bug found live testing getPreviousHabit below (2026-08-30) —
// this used to order by period_start alone. In real single-check-in-per-
// week usage that's indistinguishable from ordering by completed_at (one
// row per period, so no ties to break), which is exactly why it went
// unnoticed: nothing before getPreviousHabit needed "the single most
// recent row" to be genuinely correct, only "roughly newest-first" for
// computeHabitStreak's own week-by-week walk. Multiple check-ins landing
// in the same period (only reachable by calling /complete directly more
// than once — the UI's own due-state gate prevents it normally, this was
// caught testing the deployed build against the shared DB) share an
// identical period_start, so Postgres has no defined tie-break order
// between them — getPreviousHabit silently returned a stale row instead
// of the real latest. completed_at is a real timestamp, never tied in
// practice, and gives the exact same ordering as period_start in the
// one-row-per-week case, so this is a strictly more correct sort key
// with no behaviour change for computeHabitStreak's own consumer.
export async function getRecentCheckIns(memberId: number, limit = 26): Promise<RecentCheckIn[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("check_ins")
    .select("period_start, completed_at, answers")
    .eq("member_id", memberId)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const answers = row.answers as Record<string, unknown> | null;
    const rawHabit = answers?.habit;
    const habit = typeof rawHabit === "string" && rawHabit.trim().length > 0 ? rawHabit : null;
    const rawFollowUp = answers?.habitFollowUp;
    const habitFollowUp = rawFollowUp === "yes" || rawFollowUp === "partially" || rawFollowUp === "no" ? rawFollowUp : null;
    const rawWeekFeel = answers?.weekFeel;
    const weekFeel = typeof rawWeekFeel === "number" ? rawWeekFeel : null;
    return { periodStart: row.period_start, habit, habitFollowUp, weekFeel };
  });
}

// Client-perspective review, 2026-08-30 — the check-in's habit question
// never followed up on itself: a member sets a habit, and next week is
// only ever asked to set a fresh one, with nothing asking whether they
// actually kept the last one up. This is what makes that follow-up
// question possible — "the most recent check-in's habit" is exactly
// "last week's commitment" from the member's point of view, right up
// until they complete a new one (called both before rendering the
// question, in the checkin route, and again inside /complete before that
// new row is inserted — so it's always genuinely last week's, never the
// one currently being submitted).
export async function getPreviousHabit(memberId: number): Promise<string | null> {
  const [recent] = await getRecentCheckIns(memberId, 1);
  return recent?.habit ?? null;
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
