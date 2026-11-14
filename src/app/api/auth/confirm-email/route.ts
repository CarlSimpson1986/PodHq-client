import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { syncConsentedLeadToBrevo } from "@/lib/leads/brevo-lead";

/**
 * Confirms a new member's email from the signup email's token_hash link
 * (/auth/confirm — the Supabase "Confirm signup" template points there,
 * 2026-10-13). Unlike the PKCE ?code= link, this needs nothing stored on
 * the device that signed up, so it works when the email opens in Gmail or
 * Safari rather than the iOS/Android app.
 */
export async function POST(request: NextRequest) {
  let body: { tokenHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }
  if (typeof body.tokenHash !== "string" || !body.tokenHash) {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: body.tokenHash, type: "email" });
  if (error || !data.user) {
    return NextResponse.json({ status: "error" }, { status: 400 });
  }

  // Same first-confirmed-sign-in hook as complete-callback.
  if (data.user.email && data.user.email_confirmed_at) {
    await syncConsentedLeadToBrevo(data.user.id, data.user.email);
  }

  // Confirm only — the member signs in on the page this sends them to.
  // Left signed in here, the proxy would bounce /login straight to the
  // home page in this browser.
  await supabase.auth.signOut();

  return NextResponse.json({ status: "ok" });
}
