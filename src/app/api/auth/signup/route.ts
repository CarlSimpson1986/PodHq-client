import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";
import { logAuthEvent } from "@/lib/audit";
import { checkAuthActionRateLimit } from "@/lib/auth/lockout";
import { getRequestIp } from "@/lib/request-ip";
import { notifyFireAndForget } from "@/lib/notifications/core";
import { getStaffRecipients } from "@/lib/notifications/staff-recipients";
import { staffNewSignupEmail } from "@/lib/notifications/templates";
import { recordSignupLead } from "@/lib/leads/record-signup-lead";

// Never reveals whether the email was already registered — same
// no-enumeration principle as podHq's magic-link GENERIC_MESSAGE. Wording
// covers both outcomes up front (new-account confirmation link vs.
// sign-in link for an existing account) so a genuine user isn't left
// confused by a generic message that doesn't match what actually landed
// in their inbox — without the two cases ever being distinguishable from
// the response itself.
const GENERIC_MESSAGE =
  "Check your email — we've sent a confirmation link, or a sign-in link if you already have an account.";

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
  const { email, password, name, gym } = parsed.data;

  const rateLimit = await checkAuthActionRateLimit("signup", email, ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { status: "error", message: "Too many requests. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const supabase = await createSessionClient();
  const origin = request.nextUrl.origin;
  const admin = createAdminClient();

  // Check for a pre-existing auth user BEFORE calling signUp() — signUp()'s
  // own anti-enumeration behaviour silently no-ops for an email that
  // already exists anywhere in this shared project (e.g. a podHq staff
  // login) and sends no email at all, leaving no path to ever link that
  // account. Same listUsers()+find() lookup as the admin-mediated fallback
  // scripts (reset-pilot-password.mjs, link-existing-account-as-member.mjs)
  // used before this flow existed. The response below stays byte-identical
  // either way — only the real server-side action differs.
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("[signup] failed to list users", { error: listError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }
  const existingUser = usersPage.users.find((u) => u.email === email);

  if (existingUser) {
    // Verify the requester actually controls this inbox via a real
    // magic-link email — signInWithOtp sends one even for an existing user
    // (unlike signUp's silent path), so clicking it proves ownership before
    // /api/auth/link-existing-account ever creates a member row. Only ever
    // signs an *existing* user in (shouldCreateUser: false) — this branch
    // never mints a new auth.users row.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/callback?mode=link_existing&name=${encodeURIComponent(name)}&gym=${encodeURIComponent(gym)}`,
      },
    });
    if (otpError) {
      console.error("[signup] failed to send link-existing magic link", { error: otpError.message });
    } else {
      await logAuthEvent({
        email,
        userId: existingUser.id,
        eventType: "signup",
        ipAddress: ip,
        detail: "link_existing_requested",
      });
    }
    return NextResponse.json({ status: "ok", message: GENERIC_MESSAGE });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.user) {
    return NextResponse.json({ status: "ok", message: GENERIC_MESSAGE });
  }

  const { data: memberRows, error: memberError } = await admin
    .from("members")
    .insert({ auth_user_id: data.user.id, gym, name })
    .select("id");

  // 23505 = auth_user_id already has a members row (repeat signup attempt
  // for an email that already has a confirmed member account). 23503 = the
  // returned user.id has no matching auth.users row at all — the collision
  // case above now catches this ahead of time, but kept as defense in depth
  // against a race (someone else's signUp() completing between our
  // listUsers() check and this insert). Both mean "not actually a new
  // member" — not an error to surface.
  if (memberError && !["23505", "23503"].includes(memberError.code)) {
    console.error("[signup] failed to create member row", { error: memberError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  // Skip the audit log when the id was never real (23503) — logging it would
  // hit the same auth_events.user_id foreign key for the same reason.
  if (!memberError || memberError.code === "23505") {
    await logAuthEvent({ email, userId: data.user.id, eventType: "signup", ipAddress: ip });
  }

  // Lead capture + staff alert only on a genuinely fresh member row
  // (!memberError) — not a 23505 repeat attempt, which isn't a new signup
  // to alert anyone about or track as a lead.
  if (!memberError) {
    const newMemberId = memberRows?.[0]?.id as number | undefined;
    if (newMemberId) {
      await recordSignupLead({ memberId: newMemberId, gym, name, email });
    }

    const staffEmails = await getStaffRecipients(gym);
    const { subject, html } = staffNewSignupEmail({ memberName: name, gym });
    for (const to of staffEmails) {
      await notifyFireAndForget({ eventType: "staff_new_signup", to, subject, html, gym });
    }
  }

  return NextResponse.json({ status: "ok", message: GENERIC_MESSAGE });
}
