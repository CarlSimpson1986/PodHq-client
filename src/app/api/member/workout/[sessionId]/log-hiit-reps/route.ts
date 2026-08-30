import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId, logHiitReps } from "@/lib/coach/workout-session";
import { logHiitRepsSchema } from "@/lib/validation/workout";
import { checkRateLimit } from "@/lib/rate-limit";

// HIIT reps tally (2026-08-30) — a separate endpoint from /complete-hiit
// deliberately: completion is automatic and unconditional (the sequencer
// posts it the moment the timer finishes, see workout-view.tsx), while
// this is the optional follow-up step a member can skip entirely. Same
// auth/rate-limit/ownership pattern as every other workout-session route.
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/log-hiit-reps");
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

  const parsed = logHiitRepsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const ownerMemberId = await getSessionOwnerMemberId(sessionIdNum);
  if (ownerMemberId === null || ownerMemberId !== member.id) {
    return NextResponse.json({ status: "error", message: "Session not found." }, { status: 404 });
  }

  try {
    await logHiitReps(sessionIdNum, parsed.data.reps);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[workout-log-hiit-reps] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
