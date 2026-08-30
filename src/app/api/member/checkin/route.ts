import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getLastCheckIn, getPreviousHabit, getRecentCheckIns } from "@/lib/coach/check-ins";
import { getCheckInDueState, currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { getWearableWeeklyReflection } from "@/lib/coach/weekly-wearable-reflection";
import { computeHabitStreak } from "@/lib/coach/habit-streak";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/checkin");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  try {
    const coachProfile = await getCoachProfile(member.id);
    const lastCheckIn = await getLastCheckIn(member.id);
    const now = new Date();
    const state = getCheckInDueState(coachProfile, lastCheckIn, now);
    const { periodStart, periodEnd } = currentCheckInPeriod(now);
    const review = coachProfile ? await getWeeklyReview(member.id, periodStart, periodEnd, member.gender) : null;

    // Client-perspective review, 2026-08-30 — no more eager narrative here:
    // it used to run before the member had answered anything, so "your
    // coach's review" could never respond to how the week actually felt or
    // what got in the way. The real response is generated in /complete
    // instead, after those answers exist — see coach-bot.ts's
    // narrateCheckInResponse for the full reasoning.
    let wearableReflection: Awaited<ReturnType<typeof getWearableWeeklyReflection>> = [];
    if (review && (state.kind === "due" || state.kind === "overdue")) {
      // No LLM/network cost, kept gated the same as the old narrative was —
      // it's part of the same check-in ritual, no reason to compute it for
      // a preview the member isn't actually acting on.
      wearableReflection = await getWearableWeeklyReflection(member.id, periodStart, {
        avgSleepMinutes: review.avgSleepMinutes,
        avgRestingHeartRate: review.avgRestingHeartRate,
      });
    }

    // previousHabit drives the new "how did last week's habit go?"
    // follow-up question (null = first-ever check-in, nothing to follow up
    // on — the question just doesn't render). habitStreakWeeks reuses the
    // same computeHabitStreak the /coach dashboard already shows, surfaced
    // here too so the member sees their own consistency at the moment
    // they're setting this week's commitment, not only on a different page.
    const previousHabit = await getPreviousHabit(member.id);
    const recentCheckIns = await getRecentCheckIns(member.id);
    const habitStreakWeeks = computeHabitStreak(recentCheckIns);

    return NextResponse.json({ status: "ok", state, review, wearableReflection, previousHabit, habitStreakWeeks });
  } catch (error) {
    console.error("[checkin] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
