import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState, currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { narrateWeeklyReview } from "@/lib/coach-bot";
import { getWearableWeeklyReflection } from "@/lib/coach/weekly-wearable-reflection";
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

    // Only generate the AI performance-review narrative for an actual due
    // check-in, not the "N days to go" preview state — an LLM call on
    // every dashboard-adjacent page load for a preview nobody asked for
    // would be pure cost with no member-facing benefit.
    let narrative: string | null = null;
    let wearableReflection: Awaited<ReturnType<typeof getWearableWeeklyReflection>> = [];
    if (review && (state.kind === "due" || state.kind === "overdue")) {
      try {
        narrative = await narrateWeeklyReview(member.name, review);
      } catch (error) {
        // Narration is presentation-only — a Groq/Claude hiccup must not
        // block the member from seeing their (already-computed) stats.
        console.error("[checkin] narration failed", { error: (error as Error).message });
      }
      // No LLM/network cost, but kept gated the same as narrative above —
      // it's part of the same check-in ritual, no reason to compute it
      // for a preview the member isn't actually acting on.
      wearableReflection = await getWearableWeeklyReflection(member.id, periodStart, {
        avgSleepMinutes: review.avgSleepMinutes,
        avgRestingHeartRate: review.avgRestingHeartRate,
      });
    }

    return NextResponse.json({ status: "ok", state, review, narrative, wearableReflection });
  } catch (error) {
    console.error("[checkin] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
