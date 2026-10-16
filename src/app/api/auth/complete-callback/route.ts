import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { syncConsentedLeadToBrevo } from "@/lib/leads/brevo-lead";
import { logAuthEvent } from "@/lib/audit";
import { getRequestIp } from "@/lib/request-ip";

/**
 * Finishes an auth flow started client-side (see /auth/callback). Accepts
 * either shape a Supabase email link can produce, same as podHq's version:
 * - { code } — PKCE, used by our own server-initiated signup confirmation.
 * - { accessToken, refreshToken } — implicit flow, used by password-recovery
 *   links (no browser session exists to hold a PKCE verifier for those).
 */
export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();

  let body: { code?: string; accessToken?: string; refreshToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  const result =
    body.accessToken && body.refreshToken
      ? await supabase.auth.setSession({
          access_token: body.accessToken,
          refresh_token: body.refreshToken,
        })
      : body.code
        ? await supabase.auth.exchangeCodeForSession(body.code)
        : { data: { user: null }, error: null };

  if (result.error || !result.data.user) {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  const user = result.data.user;

  // An email link proves the member owns the inbox, same as saving a new
  // password does — so it's a sign-in for lockout purposes too, and clears
  // a hard lock (checkLoginLockout resets on login_success). Without this a
  // locked member could get in through a reset link, skip setting a new
  // password, and stay locked out of password sign-in with no way to clear
  // it: this app has no admin unlock and the gyms are unmanned. Found
  // 2026-10-16 (test member 155: locked after 10 failures across two days,
  // three reset links used, no password saved). Email from the session the
  // link just created — never from the request body.
  if (user.email) {
    await logAuthEvent({
      email: user.email,
      userId: user.id,
      eventType: "login_success",
      ipAddress: getRequestIp(request),
      detail: "email link",
    });
  }

  // First confirmed sign-in of a member who ticked marketing consent →
  // their gym's Brevo nurture list. A no-op every other time; best-effort.
  if (user.email && user.email_confirmed_at) {
    await syncConsentedLeadToBrevo(user.id, user.email);
  }

  return NextResponse.json({ status: "ok" });
}
