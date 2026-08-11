import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuthEvent } from "@/lib/audit";
import { getRequestIp } from "@/lib/request-ip";
import { PILOT_GYM } from "@/lib/gym";

/**
 * Completes the account-linking flow: called from /auth/callback right
 * after a "type=link_existing" magic link has authenticated the caller
 * (see /api/auth/signup's collision branch). The magic link itself is the
 * proof of ownership — this route trusts the now-established session and
 * just creates the member row, same effect as
 * podHq/link-existing-account-as-member.mjs but self-service.
 */
export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const name = (body.name ?? "").trim().slice(0, 100) || user.email.split("@")[0];

  const admin = createAdminClient();

  // Idempotent — a member row may already exist if this link is clicked
  // twice, or if the account was already linked some other way.
  const { data: existingMember } = await admin
    .from("members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    return NextResponse.json({ status: "ok" });
  }

  const { error } = await admin.from("members").insert({ auth_user_id: user.id, gym: PILOT_GYM, name });

  if (error) {
    console.error("[link-existing-account] failed to create member row", { error: error.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  await logAuthEvent({
    email: user.email,
    userId: user.id,
    eventType: "account_linked",
    ipAddress: getRequestIp(request),
  });

  return NextResponse.json({ status: "ok" });
}
