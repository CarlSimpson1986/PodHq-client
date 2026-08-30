import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getOrCreateWorkoutSession, type WorkoutChoice } from "@/lib/coach/workout-session";
import { generateWorkoutSchema } from "@/lib/validation/workout";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/generate");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = generateWorkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  if (!(await hasPremium(member))) {
    return NextResponse.json({ status: "error", message: "AI Coach requires an active trial or membership." }, { status: 403 });
  }

  // Booking must belong to this member — never trusted as-is, same
  // IDOR-proofing pattern as every other gym-scoped write in this app.
  const admin = createAdminClient();
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, member_id, resource_id")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (bookingError) {
    console.error("[workout-generate] booking lookup failed", { error: bookingError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
  if (!booking || booking.member_id !== member.id) {
    return NextResponse.json({ status: "error", message: "Booking not found." }, { status: 404 });
  }

  const choice: WorkoutChoice =
    parsed.data.mode === "focus"
      ? { mode: "focus", focusMuscleGroups: parsed.data.focusMuscleGroups! }
      : parsed.data.mode === "custom"
        ? { mode: "custom", customExerciseKeys: parsed.data.customExerciseKeys!, customExerciseRests: parsed.data.customExerciseRests }
        : parsed.data.mode === "custom-amrap"
          ? { mode: "custom-amrap", timeCapSeconds: parsed.data.timeCapSeconds!, exercises: parsed.data.amrapExercises! }
          : parsed.data.mode === "custom-rft"
            ? {
                mode: "custom-rft",
                targetRounds: parsed.data.targetRounds!,
                timeCapSeconds: parsed.data.timeCapSeconds!,
                exercises: parsed.data.amrapExercises!,
              }
            : { mode: "default" };

  try {
    const { detail, introNarration } = await getOrCreateWorkoutSession(member.id, booking.id, booking.resource_id, member.name, choice);
    return NextResponse.json({ status: "ok", session: detail, introNarration });
  } catch (error) {
    if ((error as Error).message === "coach_profile_missing") {
      return NextResponse.json({ status: "error", message: "coach_profile_missing" }, { status: 409 });
    }
    if ((error as Error).message === "no_eligible_exercises") {
      return NextResponse.json({ status: "error", message: "no_eligible_exercises" }, { status: 422 });
    }
    console.error("[workout-generate] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
