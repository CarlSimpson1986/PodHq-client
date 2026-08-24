import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId, applyRecoveryAdjustment } from "@/lib/coach/workout-session";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/apply-recovery-adjustment");
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
    const detail = await applyRecoveryAdjustment(member.id, sessionIdNum);
    return NextResponse.json({ status: "ok", session: detail });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "session_already_started") {
      return NextResponse.json({ status: "error", message: "This session has already started." }, { status: 409 });
    }
    if (message === "recovery_already_applied") {
      return NextResponse.json({ status: "error", message: "Already reduced for today." }, { status: 409 });
    }
    console.error("[workout-apply-recovery-adjustment] failed", { error: message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
