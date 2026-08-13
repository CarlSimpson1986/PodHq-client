import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId, getPodConfig } from "@/lib/data/member";
import { createBookingSchema } from "@/lib/validation/booking";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyFireAndForget } from "@/lib/notifications/core";
import { bookingConfirmedEmail } from "@/lib/notifications/templates";

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

  // Self-service-only restriction — staff can knowingly book outside these
  // hours from podHq's admin Pods page, but the member-facing booking flow
  // respects whatever the gym has configured (defaults to all-day). Reads
  // the hour via Europe/London specifically rather than the server's own
  // local time — Vercel's serverless functions run in UTC regardless of
  // the `lhr1` region pin, so a plain .getHours() would be off by an hour
  // during BST (this gym's slots are always constructed from the member's
  // browser in UK wall-clock time, so the check needs to use the same
  // frame of reference to compare correctly against the configured hours).
  const { openHour, closeHour } = await getPodConfig(member.gym);
  const slotHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(
      new Date(parsed.data.slotStart)
    )
  );
  if (slotHour < openHour || slotHour >= closeHour) {
    return NextResponse.json({ status: "error", message: "That time is outside booking hours." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: bookingId, error } = await admin.rpc("create_booking", {
    p_member_id: member.id,
    p_gym: member.gym,
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
    const { subject, html } = bookingConfirmedEmail({
      memberName: member.name,
      gym: member.gym,
      slotStart: parsed.data.slotStart,
    });
    await notifyFireAndForget({
      eventType: "booking_confirmed",
      to: user.email,
      subject,
      html,
      memberId: member.id,
    });
  }

  return NextResponse.json({ status: "ok", bookingId });
}
