import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveHealthConnectConnection } from "@/lib/data/wearables";

// Called by the native app right after the member grants Health Connect
// permissions on-device (Health.requestAuthorization() resolving) — there's
// no OAuth redirect/callback pair here like Fitbit's, just "permission was
// granted, record the connection." A plain fetch, not a navigation.
export async function POST() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/wearables/health-connect/connect");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  try {
    await saveHealthConnectConnection(member.id);
  } catch (err) {
    console.error("[wearables] health-connect connect failed", { memberId: member.id, error: (err as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
