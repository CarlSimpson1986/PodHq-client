import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveOnDeviceHealthConnection } from "@/lib/data/wearables";

// Called by the native app right after the member grants on-device health
// permissions (Health.requestAuthorization() resolving) — there's no
// OAuth redirect/callback pair here like Fitbit's, just "permission was
// granted, record the connection." A plain fetch, not a navigation.
//
// Accepts a `provider` field ("health_connect" or "healthkit") since
// 2026-09-09 — before that this route only ever ran on Android and hard-
// coded "health_connect"; iOS support needs the client to say which OS
// actually granted the permission, since this same route now serves both.
export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const provider = (body as { provider?: unknown }).provider;
  if (provider !== "health_connect" && provider !== "healthkit") {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  try {
    await saveOnDeviceHealthConnection(member.id, provider);
  } catch (err) {
    console.error("[wearables] on-device health connect failed", { memberId: member.id, provider, error: (err as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
