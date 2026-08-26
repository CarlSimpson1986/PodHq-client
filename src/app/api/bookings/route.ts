import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId, getPodResourceById, isAccessComplete, getCreditBalance, getActiveMembership } from "@/lib/data/member";
import { isWithinBookableHours } from "@/lib/pods/bookable-hours";
import { createBookingSchema } from "@/lib/validation/booking";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyFireAndForget, appUrl } from "@/lib/notifications/core";
import { bookingConfirmedEmail, creditsLowEmail } from "@/lib/notifications/templates";

// "Running low" fires once, when a booking leaves the member with exactly
// this many credits — a heads-up while they can still book one more
// session, not a last-second warning after they're already out.
const LOW_CREDITS_THRESHOLD = 1;

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/bookings");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  // Cross-gym PAYG booking (2026-08-26): a resource no longer has to
  // belong to the member's own gym, but a member with an active
  // membership is still locked to their home gym — membership pricing/
  // capacity planning assumes members are drawn from that gym's own
  // catchment (see ROADMAP.md), unlike PAYG credits, which aren't
  // gym-scoped in the schema at all (credits table has no gym column).
  const resource = await getPodResourceById(parsed.data.resourceId);
  if (!resource) {
    return NextResponse.json({ status: "error", message: "Resource not found." }, { status: 404 });
  }
  if (resource.gym !== member.gym) {
    const membership = await getActiveMembership(member.id);
    if (membership) {
      return NextResponse.json(
        { status: "error", message: "Membership bookings are only available at your own gym." },
        { status: 403 }
      );
    }
  }

  // Self-service-only restriction — staff can knowingly book outside these
  // hours from podHq's admin Pods page, but the member-facing booking flow
  // respects whatever the gym has configured (defaults to all-day). Reads
  // the hour via Europe/London specifically rather than the server's own
  // local time — Vercel's serverless functions run in UTC regardless of
  // the `lhr1` region pin, so a plain .getHours() would be off by an hour
  // during BST (this gym's slots are always constructed from the member's
  // browser in UK wall-clock time, so the check needs to use the same
  // frame of reference to compare correctly against the configured hours).
  if (!isWithinBookableHours(parsed.data.slotStart, resource.openHour, resource.closeHour)) {
    return NextResponse.json({ status: "error", message: "That time is outside booking hours." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: bookingId, error } = await admin.rpc("create_booking", {
    p_member_id: member.id,
    p_resource_id: resource.id,
    p_slot_start: parsed.data.slotStart,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return NextResponse.json({ status: "error", message: "Not enough credits to book this slot." }, { status: 409 });
    }
    if (error.message.includes("slot_full")) {
      return NextResponse.json({ status: "error", message: "That slot is fully booked." }, { status: 409 });
    }
    if (error.message.includes("slot_reserved")) {
      return NextResponse.json(
        { status: "error", message: "This slot is reserved for someone on the waitlist right now." },
        { status: 409 }
      );
    }
    if (error.message.includes("duplicate key") || error.code === "23505") {
      return NextResponse.json({ status: "error", message: "That slot is already booked." }, { status: 409 });
    }
    return NextResponse.json({ status: "error", message: "Could not create booking." }, { status: 500 });
  }

  // Trial-clock start (Hove beta): gated on trial_started_at being null,
  // not on booking count — a long-tenured member who activates the trial
  // later still has plenty of booking history, so "first booking ever"
  // would never fire for them. Gating on the null timestamp instead means
  // "first booking since activating," and only ever fires once.
  if (member.trial_activated_at && !member.trial_started_at) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { error: trialError } = await admin
      .from("members")
      .update({ trial_started_at: now.toISOString(), trial_expires_at: expiresAt.toISOString() })
      .eq("id", member.id);
    if (trialError) {
      console.error("[bookings] failed to start trial clock", { error: trialError.message });
    }
  }

  if (user.email) {
    // Count excludes the booking we just created — 0 prior rows means this
    // is genuinely their first, not just their first of the day.
    const { count: priorBookings } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id)
      .neq("id", bookingId as number);

    const { subject, html } = bookingConfirmedEmail({
      memberName: member.name,
      gym: resource.gym,
      slotStart: parsed.data.slotStart,
      isFirstBooking: (priorBookings ?? 0) === 0,
      accessComplete: isAccessComplete(member),
    });
    await notifyFireAndForget({
      eventType: "booking_confirmed",
      to: user.email,
      subject,
      html,
      memberId: member.id,
      gym: resource.gym,
    });

    const creditsRemaining = await getCreditBalance(member.id, resource.creditType);
    if (creditsRemaining === LOW_CREDITS_THRESHOLD) {
      const lowCredits = creditsLowEmail({
        memberName: member.name,
        creditsRemaining,
        buyCreditsUrl: `${appUrl()}/buy-credits`,
      });
      await notifyFireAndForget({
        eventType: "credits_low",
        to: user.email,
        subject: lowCredits.subject,
        html: lowCredits.html,
        memberId: member.id,
        gym: member.gym,
      });
    }
  }

  return NextResponse.json({ status: "ok", bookingId });
}
