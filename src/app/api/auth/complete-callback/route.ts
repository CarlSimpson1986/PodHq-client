import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

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

  return NextResponse.json({ status: "ok" });
}
