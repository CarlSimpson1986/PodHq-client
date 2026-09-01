import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getWearableConnection, saveWearableSnapshot } from "@/lib/data/wearables";
import { healthConnectSyncSchema } from "@/lib/validation/health-connect-sync";

// Called by the native app after each on-device Health Connect read —
// there's no server-side cron possible here (Fitbit's /api/wearables/sync
// works because Google holds the data in the cloud; Health Connect only
// exists on the device itself), so the app pushes what it read instead of
// a cron pulling it. Reuses saveWearableSnapshot unchanged — that
// function was already provider-agnostic, it just upserts member_wearable_data
// by (member_id, recorded_date).
export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/wearables/health-connect/sync");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  // Guards against a stale client still POSTing after the member
  // disconnected (e.g. a background sync that started before disconnect
  // completed) — without a live health_connect connection row there's
  // nothing to attribute this sync to.
  const connection = await getWearableConnection(member.id);
  if (!connection || connection.provider !== "health_connect") {
    return NextResponse.json({ status: "error", message: "Health Connect isn't connected." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = healthConnectSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  try {
    for (const snapshot of parsed.data.snapshots) {
      await saveWearableSnapshot(member.id, {
        recordedDate: snapshot.recordedDate,
        steps: snapshot.steps,
        sleepMinutes: snapshot.sleepMinutes,
        restingHeartRate: snapshot.restingHeartRate,
        hrvMs: snapshot.hrvMs,
      });
    }
  } catch (err) {
    console.error("[wearables] health-connect sync failed", { memberId: member.id, error: (err as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
