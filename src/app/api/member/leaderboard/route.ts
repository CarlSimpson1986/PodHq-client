import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getMonthlySessionsLeaderboard, getWeeklyStepsLeaderboard, getStreakLeaderboard } from "@/lib/coach/leaderboard";
import { checkRateLimit } from "@/lib/rate-limit";

// Open to every member, not just AI Coach subscribers — the whole point
// of this leaderboard is that sessions/streak (attendance-based) and
// steps (wearable-based) don't depend on premium status. Viewable by
// anyone regardless of their own opt-in status; only opted-in members
// appear IN the boards.
export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/leaderboard");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  try {
    const [sessions, streaks, steps] = await Promise.all([
      getMonthlySessionsLeaderboard(member.id),
      getStreakLeaderboard(member.id),
      getWeeklyStepsLeaderboard(member.id),
    ]);
    return NextResponse.json({ status: "ok", optedIn: member.leaderboard_opt_in, sessions, streaks, steps });
  } catch (error) {
    console.error("[leaderboard] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
