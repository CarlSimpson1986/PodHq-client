import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getWearableConnection, saveWearableSnapshot } from "@/lib/data/wearables";
import { fetchDailyData } from "@/lib/wearables/google-health";

// Low limit — this hits Google's API directly and a member only has one
// real reason to press it (pull in the latest day without waiting for the
// nightly cron), not something legitimately clicked repeatedly.
const REFRESH_LIMIT_PER_MINUTE = 5;

// Member-triggered on-demand sync, distinct from /api/wearables/sync
// (that one is CRON_SECRET-gated and loops every connected member for
// Vercel's nightly job). This is session-authenticated and scoped to the
// caller's own connection only.
export async function POST() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/wearables/fitbit/refresh", REFRESH_LIMIT_PER_MINUTE);
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const connection = await getWearableConnection(member.id);
  if (!connection) {
    return NextResponse.json({ status: "error", message: "No wearable connected." }, { status: 404 });
  }

  // Same "yesterday, not today" logic as the nightly cron (see that
  // route's comment) — today's figures are still incomplete, so this
  // button re-fetches the same guaranteed-stable day rather than a
  // partial one. Its value is not waiting up to 24h for the cron to run
  // after first connecting, not intraday freshness.
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateIso = yesterday.toISOString().slice(0, 10);

  try {
    const data = await fetchDailyData(connection.refreshToken, dateIso);
    await saveWearableSnapshot(member.id, {
      recordedDate: dateIso,
      steps: data.steps,
      sleepMinutes: data.sleepMinutes,
      restingHeartRate: data.restingHeartRate,
    });
  } catch (err) {
    console.error("[wearables] manual refresh failed", { memberId: member.id, error: (err as Error).message });
    return NextResponse.json({ status: "error", message: "Couldn't refresh right now. Try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ status: "ok", date: dateIso });
}
