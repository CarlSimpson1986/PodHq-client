import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildAuthorizationUrl } from "@/lib/wearables/google-health";

const STATE_COOKIE = "wearable_oauth_state";

// Starts the OAuth flow — a plain top-level GET navigation (a link/button
// on the Profile page, not a fetch), since the member's browser needs to
// actually navigate to Google's consent screen.
export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const rateLimit = await checkRateLimit(user.id, "/api/wearables/fitbit/connect");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.redirect(new URL("/coach/profile", request.url));
  }

  // CSRF protection on the OAuth callback — a random value only this
  // response's cookie and the eventual callback's query string both
  // know, so a forged callback request (without the matching cookie)
  // can't be used to link an attacker's Fitbit account to a victim's
  // session. Doesn't need to encode the member id — the callback
  // re-derives the member from the session cookie, same as this route.
  const state = randomBytes(16).toString("hex");

  const response = NextResponse.redirect(buildAuthorizationUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
