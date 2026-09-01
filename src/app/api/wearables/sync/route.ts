import { NextResponse, type NextRequest } from "next/server";
import { getAllWearableConnections, saveWearableSnapshot } from "@/lib/data/wearables";
import { fetchDailyData } from "@/lib/wearables/google-health";

// Vercel Cron hits this once a day — same CRON_SECRET fail-closed
// pattern as /api/waitlist/expire (see that route's own comment): no
// member session exists here, Vercel Cron is the only expected caller.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[wearables] CRON_SECRET is not configured");
    return NextResponse.json({ status: "error", message: "Not configured." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized." }, { status: 401 });
  }

  // Yesterday, not today — today's data is still incomplete (a member's
  // step count keeps climbing all day), so syncing "yesterday" is the
  // first day guaranteed to be a complete, stable snapshot.
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateIso = yesterday.toISOString().slice(0, 10);

  const connections = await getAllWearableConnections();

  let synced = 0;
  let failed = 0;
  for (const connection of connections) {
    // getAllWearableConnections already filters to provider='fitbit' at
    // the query level — this narrows the type to match (refreshToken:
    // string, not string | null) rather than asserting it.
    if (connection.provider !== "fitbit") continue;
    try {
      const data = await fetchDailyData(connection.refreshToken, dateIso);
      await saveWearableSnapshot(connection.memberId, {
        recordedDate: dateIso,
        steps: data.steps,
        sleepMinutes: data.sleepMinutes,
        restingHeartRate: data.restingHeartRate,
        hrvMs: data.hrvMs,
      });
      synced++;
    } catch (err) {
      // One member's revoked token or a transient API error must not
      // abort the whole batch — same resilience posture as every other
      // loop-over-members job in this codebase (e.g. the webhook's
      // per-recipient notification loop).
      console.error("[wearables] sync failed for one member, continuing", { memberId: connection.memberId, error: (err as Error).message });
      failed++;
    }
  }

  return NextResponse.json({ status: "ok", date: dateIso, synced, failed });
}
