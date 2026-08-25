import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonMidnight, londonDateString } from "@/lib/london-time";

export interface LeaderboardEntry {
  memberId: number;
  displayName: string;
  value: number;
  isSelf: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// How far back the streak calculation looks before giving up — a streak
// genuinely broken more than 3 months ago isn't worth walking further
// back for.
const STREAK_WEEKS_WINDOW = 12;
// Weekly target for opted-in members with no AI Coach profile (no
// sessions_per_week to compare against) — "at least one session that
// week" is the only signal available for someone who never set a
// personal goal, not a lesser standard, just the only one there is.
const DEFAULT_WEEKLY_TARGET = 1;

// "First L." — never a full name or anything more identifying, and only
// for members who've explicitly opted in (members.leaderboard_opt_in,
// off by default). See migration 0062.
export function displayNameFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Member";
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

async function getOptedInMembers(): Promise<Map<number, { name: string }>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("members").select("id, name").eq("leaderboard_opt_in", true);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((m) => [m.id, { name: m.name }]));
}

function rankByValue(optedIn: Map<number, { name: string }>, valueByMember: Map<number, number>, callerMemberId: number): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  for (const [memberId, info] of optedIn) {
    const value = valueByMember.get(memberId) ?? 0;
    if (value <= 0) continue; // no zero-activity rows cluttering the board
    entries.push({ memberId, displayName: displayNameFor(info.name), value, isSelf: memberId === callerMemberId });
  }
  return entries.sort((a, b) => b.value - a.value);
}

// "Sessions this month" — real Kisi unlocks (pod_access_events.success),
// not bookings.status: that column never actually transitions to
// 'completed' anywhere in either codebase (confirmed 2026-08-25 before
// building this — every booking that isn't cancelled just sits at
// 'booked' forever today), so it can't be trusted as an attendance
// signal. A successful physical door unlock is the genuinely cheat-proof
// one. Counts distinct bookings with at least one successful unlock, not
// raw event rows (a retried unlock on the same booking must not count
// twice).
export async function getMonthlySessionsLeaderboard(callerMemberId: number): Promise<LeaderboardEntry[]> {
  const optedIn = await getOptedInMembers();
  if (optedIn.size === 0) return [];

  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data, error } = await admin
    .from("pod_access_events")
    .select("member_id, booking_id, attempted_at")
    .eq("success", true)
    .in("member_id", [...optedIn.keys()])
    .gte("attempted_at", monthStart);
  if (error) throw new Error(error.message);

  const bookingsByMember = new Map<number, Set<number>>();
  for (const row of data ?? []) {
    const set = bookingsByMember.get(row.member_id) ?? new Set<number>();
    set.add(row.booking_id);
    bookingsByMember.set(row.member_id, set);
  }

  const countByMember = new Map<number, number>();
  for (const [memberId, bookings] of bookingsByMember) countByMember.set(memberId, bookings.size);

  return rankByValue(optedIn, countByMember, callerMemberId);
}

// "Steps this week" — the one metric that never depends on AI Coach at
// all (unlike sessions/streak, which have a target-based fallback for
// PAYG members but are still grounded in the same booking-attendance
// data; steps come straight from member_wearable_data, open to every
// member since the Health tab's premium gate was removed the same day).
export async function getWeeklyStepsLeaderboard(callerMemberId: number): Promise<LeaderboardEntry[]> {
  const optedIn = await getOptedInMembers();
  if (optedIn.size === 0) return [];

  const admin = createAdminClient();
  // londonMidnight returns a UTC instant (23:00 UTC the previous day
  // during BST) — reading its calendar date back out via .toISOString()
  // would silently give the wrong day (exactly the class of bug
  // london-time.ts's own header comment warns about repeatedly).
  // londonDateString goes through Intl properly instead, same as every
  // other date-boundary calculation in this codebase.
  const weekStart = new Date(londonMidnight(new Date()).getTime() - 6 * MS_PER_DAY);
  const weekStartIso = londonDateString(weekStart);

  const { data, error } = await admin
    .from("member_wearable_data")
    .select("member_id, steps, recorded_date")
    .in("member_id", [...optedIn.keys()])
    .gte("recorded_date", weekStartIso);
  if (error) throw new Error(error.message);

  const stepsByMember = new Map<number, number>();
  for (const row of data ?? []) {
    if (row.steps === null) continue;
    stepsByMember.set(row.member_id, (stepsByMember.get(row.member_id) ?? 0) + row.steps);
  }

  return rankByValue(optedIn, stepsByMember, callerMemberId);
}

// weeksAgo 0 = this week (possibly still in progress). This week only
// counts toward the streak if it's already hit target — not meeting
// target yet with days still left in the week is "not finished", not a
// miss, so it's simply excluded rather than breaking the streak. Walks
// backward through fully-elapsed weeks from there, stopping at the first
// one that falls short.
export function computeStreak(weeklyCounts: Map<number, number>, target: number): number {
  let streak = 0;
  if ((weeklyCounts.get(0) ?? 0) >= target) streak++;

  for (let weeksAgo = 1; weeksAgo <= STREAK_WEEKS_WINDOW; weeksAgo++) {
    const count = weeklyCounts.get(weeksAgo);
    if (count === undefined || count < target) break;
    streak++;
  }
  return streak;
}

// "Current streak" — consecutive weeks hitting your OWN weekly target
// (coach_profiles.sessions_per_week for AI Coach members, else
// DEFAULT_WEEKLY_TARGET), not an absolute session count. A member with a
// 2x/week goal and one with a 4x/week goal can both have a "perfect"
// streak — this measures reliability to your own commitment, not
// volume; raw volume is what the monthly sessions board already ranks.
export async function getStreakLeaderboard(callerMemberId: number): Promise<LeaderboardEntry[]> {
  const optedIn = await getOptedInMembers();
  if (optedIn.size === 0) return [];

  const admin = createAdminClient();
  const since = new Date(Date.now() - (STREAK_WEEKS_WINDOW + 1) * 7 * MS_PER_DAY);

  const [eventsResult, profilesResult] = await Promise.all([
    admin
      .from("pod_access_events")
      .select("member_id, booking_id, attempted_at")
      .eq("success", true)
      .in("member_id", [...optedIn.keys()])
      .gte("attempted_at", since.toISOString()),
    admin.from("coach_profiles").select("member_id, sessions_per_week").in("member_id", [...optedIn.keys()]),
  ]);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);

  const targetByMember = new Map<number, number>((profilesResult.data ?? []).map((p) => [p.member_id, p.sessions_per_week]));

  // member -> weeksAgo -> distinct booking_ids that week
  const weeklyByMember = new Map<number, Map<number, Set<number>>>();
  const nowMidnight = londonMidnight(new Date()).getTime();

  for (const row of eventsResult.data ?? []) {
    const eventMidnight = londonMidnight(new Date(row.attempted_at)).getTime();
    const daysAgo = Math.round((nowMidnight - eventMidnight) / MS_PER_DAY);
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo < 0 || weeksAgo > STREAK_WEEKS_WINDOW) continue;

    const weeks = weeklyByMember.get(row.member_id) ?? new Map<number, Set<number>>();
    const bookings = weeks.get(weeksAgo) ?? new Set<number>();
    bookings.add(row.booking_id);
    weeks.set(weeksAgo, bookings);
    weeklyByMember.set(row.member_id, weeks);
  }

  const entries: LeaderboardEntry[] = [];
  for (const [memberId, info] of optedIn) {
    const target = targetByMember.get(memberId) ?? DEFAULT_WEEKLY_TARGET;
    const weeks = weeklyByMember.get(memberId);
    const counts = new Map<number, number>();
    if (weeks) for (const [weeksAgo, bookings] of weeks) counts.set(weeksAgo, bookings.size);

    const streak = computeStreak(counts, target);
    if (streak <= 0) continue;
    entries.push({ memberId, displayName: displayNameFor(info.name), value: streak, isSelf: memberId === callerMemberId });
  }
  return entries.sort((a, b) => b.value - a.value);
}

export async function setLeaderboardOptIn(memberId: number, optIn: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("members").update({ leaderboard_opt_in: optIn }).eq("id", memberId);
  if (error) throw new Error(error.message);
}
