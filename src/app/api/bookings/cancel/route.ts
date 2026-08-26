import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { cancelBookingSchema } from "@/lib/validation/booking";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyFireAndForget } from "@/lib/notifications/core";
import { bookingCancelledEmail } from "@/lib/notifications/templates";
import { offerNextWaitlistEntry } from "@/lib/waitlist/offer-next";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/bookings/cancel");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = cancelBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  // p_member_id comes from the caller's own verified session, never from
  // the request body — doubles as the ownership check, since cancel_booking
  // only matches a row where both booking id and member id line up.
  const { data: refunded, error } = await admin.rpc("cancel_booking", {
    p_member_id: member.id,
    p_booking_id: parsed.data.bookingId,
  });

  if (error) {
    if (error.message.includes("booking_not_found")) {
      return NextResponse.json({ status: "error", message: "Booking not found." }, { status: 404 });
    }
    if (error.message.includes("already_cancelled")) {
      return NextResponse.json({ status: "error", message: "That booking can't be cancelled." }, { status: 409 });
    }
    return NextResponse.json({ status: "error", message: "Could not cancel booking." }, { status: 500 });
  }

  if (user.email) {
    // cancel_booking() only returns the refund boolean, not the booking's
    // own slot_start/gym — a cheap extra lookup rather than widening the
    // RPC's return shape for every other caller of it. gym comes from the
    // booking's own row, not member.gym — since cross-gym PAYG booking
    // (2026-08-26), those can genuinely differ.
    const { data: booking } = await admin
      .from("bookings")
      .select("slot_start, resource_id, gym")
      .eq("id", parsed.data.bookingId)
      .maybeSingle();

    const { subject, html } = bookingCancelledEmail({
      memberName: member.name,
      gym: booking?.gym ?? member.gym,
      slotStart: booking?.slot_start ?? "",
      refunded: Boolean(refunded),
    });
    await notifyFireAndForget({
      eventType: "booking_cancelled",
      to: user.email,
      subject,
      html,
      memberId: member.id,
      gym: booking?.gym ?? member.gym,
    });

    if (booking?.slot_start && booking.resource_id) {
      await offerNextWaitlistEntry(booking.resource_id, booking.slot_start);
    }
  }

  return NextResponse.json({ status: "ok", refunded });
}
