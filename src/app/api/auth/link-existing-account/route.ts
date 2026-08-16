import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuthEvent } from "@/lib/audit";
import { getRequestIp } from "@/lib/request-ip";
import { GYM_NAMES, type GymName } from "@/lib/gym";

function isGymName(value: string): value is GymName {
  return (GYM_NAMES as readonly string[]).includes(value);
}

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

  let body: { name?: string; gym?: string };
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

  // gym travels through the magic-link redirect URL (see signup's
  // collision branch) rather than being re-entered here — a missing/
  // invalid value only happens for a stale link sent before this field
  // existed, or tampering, neither of which should silently default to a
  // gym the member never actually picked.
  const gym = body.gym ?? "";
  if (!isGymName(gym)) {
    return NextResponse.json(
      { status: "error", message: "This link has expired. Please sign up again." },
      { status: 400 }
    );
  }

  const { error } = await admin.from("members").insert({ auth_user_id: user.id, gym, name });

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
