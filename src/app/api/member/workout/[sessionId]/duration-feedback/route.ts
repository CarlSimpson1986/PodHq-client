import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId } from "@/lib/coach/workout-session";
import { submitDurationFeedback } from "@/lib/coach/coach-profile";
import { durationFeedbackSchema } from "@/lib/validation/workout";
import { checkRateLimit } from "@/lib/rate-limit";

// "How was your workout?" (2026-09-07, Carl) — self-reported once at
// session completion, feeds computeExerciseCount's next-session exercise
// count. Same route-shape as readiness-check/log-set: session ownership
// verified via getSessionOwnerMemberId before writing anything.
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/duration-feedback");
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

  const parsed = durationFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const ownerMemberId = await getSessionOwnerMemberId(sessionIdNum);
  if (ownerMemberId === null || ownerMemberId !== member.id) {
    return NextResponse.json({ status: "error", message: "Session not found." }, { status: 404 });
  }

  try {
    await submitDurationFeedback(sessionIdNum, parsed.data.feedback);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[workout-duration-feedback] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
