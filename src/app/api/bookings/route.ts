import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId, getPodResourceById, isAccessComplete, getTotalCreditBalance } from "@/lib/data/member";
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

  // Cross-gym booking (2026-08-26, extended same day to cover membership
  // members too): a resource no longer has to belong to the member's own
  // gym at all — create_booking() itself now decides whether the member
  // has the right credit to spend there (home-gym base credit, or a
  // network top-up credit for a member with an active membership; a
  // member with no membership can spend base credit anywhere, unchanged).
  // No app-layer gym check needed here any more — the RPC's own
  // 'insufficient_credits' exception (handled below) covers every case
  // that used to be a flat 403 here, and does it correctly instead of
  // blocking a membership member who actually does hold network credit.
  const resource = await getPodResourceById(parsed.data.resourceId);
  if (!resource) {
    return NextResponse.json({ status: "error", message: "Resource not found." }, { status: 404 });
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

    // Total across both credit types — a member sitting on plenty of
    // network top-up credit but 1 remaining home credit shouldn't get a
    // "running low" scare; this should reflect what they can actually
    // still spend overall, same reasoning as the Home page's headline
    // number (getTotalCreditBalance).
    const creditsRemaining = await getTotalCreditBalance(member.id, resource.creditType);
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
