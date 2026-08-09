import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";
import { logAuthEvent } from "@/lib/audit";
import { checkAuthActionRateLimit } from "@/lib/auth/lockout";
import { getRequestIp } from "@/lib/request-ip";

// Single-gym pilot scope (ROADMAP.md: "Aylesbury Berryfields only — not
// multi-gym yet") — every self-signup lands here until that scope changes.
const PILOT_GYM = "Aylesbury Berryfields";

// Never reveals whether the email was already registered — same
// no-enumeration principle as podHq's magic-link GENERIC_MESSAGE.
const GENERIC_MESSAGE = "Check your email to confirm your account.";

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const { email, password, name } = parsed.data;

  const rateLimit = await checkAuthActionRateLimit("signup", email, ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { status: "error", message: "Too many requests. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const supabase = await createSessionClient();
  const origin = request.nextUrl.origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.user) {
    // TEMP debug logging (server-side only, never sent to the client) while
    // diagnosing the Brevo SMTP setup — remove once signup is confirmed working.
    console.error("[signup] DEBUG signUp failed", { message: error?.message, status: error?.status });
    return NextResponse.json({ status: "ok", message: GENERIC_MESSAGE });
  }

  const admin = createAdminClient();
  const { error: memberError } = await admin
    .from("members")
    .insert({ auth_user_id: data.user.id, gym: PILOT_GYM, name });

  // 23505 = auth_user_id already has a members row (repeat signup attempt
  // for an email that already has a confirmed member account). 23503 = the
  // returned user.id has no matching auth.users row at all — Supabase's
  // anti-enumeration behavior for signUp() against an email that's already
  // registered under *any* account in this shared project (e.g. a podHq
  // staff login) returns a masked "success" whose id was never persisted.
  // Both cases mean "not actually a new member" — not an error to surface.
  if (memberError && !["23505", "23503"].includes(memberError.code)) {
    console.error("[signup] failed to create member row", { error: memberError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  // Skip the audit log when the id was never real (23503) — logging it would
  // hit the same auth_events.user_id foreign key for the same reason.
  if (!memberError || memberError.code === "23505") {
    await logAuthEvent({ email, userId: data.user.id, eventType: "signup", ipAddress: ip });
  }

  return NextResponse.json({ status: "ok", message: GENERIC_MESSAGE });
}
