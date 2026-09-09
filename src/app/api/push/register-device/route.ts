import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { pushRegisterDeviceSchema } from "@/lib/validation/push";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/push/register-device");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = pushRegisterDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  // Upsert on fcm_token (unique) — a re-registered device (e.g. after a
  // reinstall issuing the same token, or a routine token refresh) just
  // refreshes the row rather than erroring or duplicating.
  const { error } = await admin
    .from("push_device_tokens")
    .upsert(
      { member_id: member.id, fcm_token: parsed.data.fcmToken, platform: parsed.data.platform },
      { onConflict: "fcm_token" }
    );

  if (error) {
    console.error("[push] failed to store device token", { memberId: member.id, error: error.message });
    return NextResponse.json({ status: "error", message: "Could not save device token." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
