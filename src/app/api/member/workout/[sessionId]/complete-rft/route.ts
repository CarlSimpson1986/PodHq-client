import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId, completeRoundsForTimeSession } from "@/lib/coach/workout-session";
import { completeRftSchema } from "@/lib/validation/workout";
import { checkRateLimit } from "@/lib/rate-limit";

// RFT's own completion endpoint (Stage 3, 2026-08-30) — separate from
// /complete because there are no logged sets to derive volume from, same
// as AMRAP. Payload shape mirrors /complete-amrap (self-reported rounds +
// optional partial round), since a real RFT time cap means a member can
// genuinely fail to finish — see completeRoundsForTimeSession's own
// comment.
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/complete-rft");
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

  const parsed = completeRftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const ownerMemberId = await getSessionOwnerMemberId(sessionIdNum);
  if (ownerMemberId === null || ownerMemberId !== member.id) {
    return NextResponse.json({ status: "error", message: "Session not found." }, { status: 404 });
  }

  try {
    await completeRoundsForTimeSession(sessionIdNum, {
      elapsedSeconds: parsed.data.elapsedSeconds,
      roundsCompleted: parsed.data.roundsCompleted,
      partialRoundExerciseIndex: parsed.data.partialRoundExerciseIndex ?? null,
      partialRoundReps: parsed.data.partialRoundReps ?? null,
    });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[workout-complete-rft] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
