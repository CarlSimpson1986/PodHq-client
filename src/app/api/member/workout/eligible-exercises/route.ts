import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getExcludedExerciseKeysForBooking } from "@/lib/coach/workout-session";
import { checkRateLimit } from "@/lib/rate-limit";

// Drives the "build your own" picker (workout-view.tsx) — reachable both
// pre-session (via /generate, no longer exposed in the UI as of
// 2026-08-29, but the endpoint itself is choice-agnostic) and post-session
// via the "Change today's workout" flow. Read-only GET rather than reusing
// the POST /generate or /change-mode routes, since this needs to run
// *before* a mode is chosen — the picker has to know what's eligible in
// order to offer it. Same session→rate-limit→member→premium→booking-
// ownership shape as those routes, just no session-creation side effect.
export async function GET(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/eligible-exercises");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const bookingIdRaw = new URL(request.url).searchParams.get("bookingId");
  const bookingId = bookingIdRaw ? Number(bookingIdRaw) : NaN;
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  if (!(await hasPremium(member))) {
    return NextResponse.json({ status: "error", message: "AI Coach requires an active trial or membership." }, { status: 403 });
  }

  // Booking must belong to this member — never trusted as-is, same
  // IDOR-proofing pattern as every other gym-scoped read/write in this app.
  const admin = createAdminClient();
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, member_id, resource_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("[workout-eligible-exercises] booking lookup failed", { error: bookingError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
  if (!booking || booking.member_id !== member.id) {
    return NextResponse.json({ status: "error", message: "Booking not found." }, { status: 404 });
  }

  try {
    const excludedExerciseKeys = await getExcludedExerciseKeysForBooking(member.id, booking.resource_id);
    return NextResponse.json({ status: "ok", excludedExerciseKeys });
  } catch (error) {
    console.error("[workout-eligible-exercises] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
