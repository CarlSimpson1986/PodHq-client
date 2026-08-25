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

  // Deliberately TODAY, not yesterday like the nightly cron — this was
  // wrong until 2026-08-24 (same day, found live): a member who connects
  // and immediately taps Refresh has, by definition, no data for
  // yesterday (the connection didn't exist yet), so copying the cron's
  // "yesterday, guaranteed-stable" logic verbatim made this button
  // structurally unable to ever show anything on day one. Today's figures
  // are necessarily partial (steps keep climbing), but partial-and-
  // visible-now is exactly what a manual "give me the data now" button is
  // for — the nightly cron still lays down the complete, stable
  // "yesterday" snapshot every night regardless.
  const today = new Date();
  const dateIso = today.toISOString().slice(0, 10);

  try {
    const data = await fetchDailyData(connection.refreshToken, dateIso);
    await saveWearableSnapshot(member.id, {
      recordedDate: dateIso,
      steps: data.steps,
      sleepMinutes: data.sleepMinutes,
      restingHeartRate: data.restingHeartRate,
      hrvMs: data.hrvMs,
    });
  } catch (err) {
    console.error("[wearables] manual refresh failed", { memberId: member.id, error: (err as Error).message });
    return NextResponse.json({ status: "error", message: "Couldn't refresh right now. Try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ status: "ok", date: dateIso });
}
