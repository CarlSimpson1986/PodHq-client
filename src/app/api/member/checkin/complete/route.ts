import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { completeCheckIn } from "@/lib/coach/check-ins";
import { currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/checkin/complete");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    return NextResponse.json({ status: "error", message: "Set up your AI Coach first." }, { status: 403 });
  }

  try {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    await completeCheckIn(member.id, periodStart, periodEnd);
  } catch (error) {
    console.error("[checkin-complete] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
