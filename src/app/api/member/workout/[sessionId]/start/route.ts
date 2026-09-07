import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId, markSessionStarted } from "@/lib/coach/workout-session";
import { checkRateLimit } from "@/lib/rate-limit";

// Overall session timer (2026-09-07) — called once when the member's
// workout view first mounts into the active flow. Idempotent server-side
// (markSessionStarted only ever writes started_at while it's still null),
// so a re-mount (tab refocus, brief connectivity drop) never resets an
// in-progress timer.
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/start");
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

  const ownerMemberId = await getSessionOwnerMemberId(sessionIdNum);
  if (ownerMemberId === null || ownerMemberId !== member.id) {
    return NextResponse.json({ status: "error", message: "Session not found." }, { status: 404 });
  }

  try {
    await markSessionStarted(sessionIdNum);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[workout-start] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
