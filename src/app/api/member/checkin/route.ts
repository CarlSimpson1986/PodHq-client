import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getLastCheckIn } from "@/lib/coach/check-ins";
import { getCheckInDueState, currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
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

    return NextResponse.json({ status: "ok", state, review });
  } catch (error) {
    console.error("[checkin] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
