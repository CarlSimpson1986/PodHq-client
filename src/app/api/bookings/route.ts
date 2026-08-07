import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { createBookingSchema } from "@/lib/validation/booking";
import { checkRateLimit } from "@/lib/rate-limit";

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
    if (error.message.includes("duplicate key") || error.code === "23505") {
      return NextResponse.json({ status: "error", message: "That slot is already booked." }, { status: 409 });
    }
    return NextResponse.json({ status: "error", message: "Could not create booking." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", bookingId });
}
