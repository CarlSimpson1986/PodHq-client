import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { exchangeCodeForTokens } from "@/lib/wearables/google-health";
import { saveWearableConnection } from "@/lib/data/wearables";

const STATE_COOKIE = "wearable_oauth_state";

// Google redirects the member's browser here as a plain top-level GET —
// the member's own session cookie is present the same way it would be on
// any other page navigation, so no member identity needs to be encoded
// into the OAuth state param itself; state is CSRF protection only.
export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.redirect(new URL("/coach/health", request.url));
  }

  const { searchParams } = request.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  const failureRedirect = () => {
    const response = NextResponse.redirect(new URL("/coach/health?wearable=error", request.url));
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  // A member declining consent on Google's screen is a normal outcome,
  // not a bug — same treatment as any other cancelled-flow redirect
  // elsewhere in this app (e.g. Stripe Checkout's cancel_url).
  if (error) {
    return failureRedirect();
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    console.error("[wearables] callback state mismatch or missing code", { memberId: member.id });
    return failureRedirect();
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);
    await saveWearableConnection(member.id, refreshToken);
  } catch (err) {
    console.error("[wearables] failed to complete Fitbit connection", { memberId: member.id, error: (err as Error).message });
    return failureRedirect();
  }

  const response = NextResponse.redirect(new URL("/coach/health?wearable=connected", request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
