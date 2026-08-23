import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId, swapExercise } from "@/lib/coach/workout-session";
import { swapExerciseSchema } from "@/lib/validation/workout";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/swap-exercise");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const { sessionId } = await params;
  const sessionIdNum = Number(sessionId);
  if (!Number.isInteger(sessionIdNum) || sessionIdNum <= 0) {
    return NextResponse.json({ status: "error", message: "Invalid session." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = swapExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const ownerMemberId = await getSessionOwnerMemberId(sessionIdNum);
  if (ownerMemberId === null || ownerMemberId !== member.id) {
    return NextResponse.json({ status: "error", message: "Session not found." }, { status: 404 });
  }

  try {
    const detail = await swapExercise(member.id, sessionIdNum, parsed.data.exerciseId, parsed.data.newExerciseKey);
    return NextResponse.json({ status: "ok", session: detail });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "exercise_not_found") {
      return NextResponse.json({ status: "error", message: "Exercise not found." }, { status: 404 });
    }
    if (message === "session_already_started") {
      return NextResponse.json({ status: "error", message: "This session has already started." }, { status: 409 });
    }
    if (message === "invalid_exercise" || message === "duplicate_exercise") {
      return NextResponse.json({ status: "error", message: "That exercise isn't available for this swap." }, { status: 400 });
    }
    if (message === "coach_profile_missing") {
      return NextResponse.json({ status: "error", message: "coach_profile_missing" }, { status: 409 });
    }
    console.error("[workout-swap-exercise] failed", { error: message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
