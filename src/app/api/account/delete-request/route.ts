import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccountRequestSchema } from "@/lib/validation/account";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { getStaffRecipients } from "@/lib/notifications/staff-recipients";
import { staffAccountDeletionRequestEmail } from "@/lib/notifications/templates";
import { notifyFireAndForget } from "@/lib/notifications/core";

// Public, unauthenticated by design (2026-09-09) -- Google Play requires an
// account-deletion path that works even for someone who's uninstalled the
// app or can't sign in, so this can't sit behind the normal session gate.
// Deliberately manual, not self-service: forwards the request to staff
// (same getStaffRecipients routing as every other staff alert) rather than
// deleting anything itself -- a real person needs to check Stripe
// subscription status and booking history first, not a script.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = deleteAccountRequestSchema.safeParse({ email: searchParams.get("email") });
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Enter a valid email address." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const rateLimit = await checkRateLimit(ip ?? "unknown", "/api/account/delete-request", 5);
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Try again later." }, { status: 429 });
  }

  const { email } = parsed.data;
  const admin = createAdminClient();

  // Same listUsers()+find() lookup as signup's own collision check --
  // there's no direct "get auth user by email" call in the Admin API.
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const matchedUser = usersPage?.users.find((u) => u.email === email);

  let memberName: string | null = null;
  let gym: string | null = null;
  if (matchedUser) {
    const { data: member } = await admin.from("members").select("name, gym").eq("auth_user_id", matchedUser.id).maybeSingle();
    if (member) {
      memberName = member.name as string;
      gym = member.gym as string;
    }
  }

  // Falls back to the shared Resend account (sendEmail's own
  // gym-not-configured behaviour) when there's no real gym to route by --
  // still a real request worth forwarding, not silently dropped.
  const recipients = await getStaffRecipients(gym ?? "");
  const { subject, html } = staffAccountDeletionRequestEmail({ email, memberName, gym });
  for (const to of recipients) {
    await notifyFireAndForget({
      eventType: "account_deletion_requested",
      to,
      subject,
      html,
      gym: gym ?? "Aylesbury Berryfields",
    });
  }

  return NextResponse.json({ status: "ok" });
}
