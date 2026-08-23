import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getSessionOwnerMemberId, logSet } from "@/lib/coach/workout-session";
import { logSetSchema } from "@/lib/validation/workout";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/workout/log-set");
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

  const parsed = logSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const ownerMemberId = await getSessionOwnerMemberId(sessionIdNum);
  if (ownerMemberId === null || ownerMemberId !== member.id) {
    return NextResponse.json({ status: "error", message: "Session not found." }, { status: 404 });
  }

  // setId itself must belong to this session — a member could otherwise
  // pass a setId from a different (still their own) session, or worse,
  // guess another member's if the session check above were skipped.
  const admin = createAdminClient();
  const { data: setRow, error: setError } = await admin
    .from("workout_sets")
    .select("id, exercise_id, workout_exercises!inner(session_id)")
    .eq("id", parsed.data.setId)
    .maybeSingle();

  if (setError) {
    console.error("[workout-log-set] set lookup failed", { error: setError.message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
  const exerciseRelation = setRow?.workout_exercises as unknown as { session_id: number } | { session_id: number }[] | undefined;
  const setSessionId = Array.isArray(exerciseRelation) ? exerciseRelation[0]?.session_id : exerciseRelation?.session_id;
  if (!setRow || setSessionId !== sessionIdNum) {
    return NextResponse.json({ status: "error", message: "Set not found." }, { status: 404 });
  }

  try {
    await logSet(parsed.data.setId, {
      repsActual: parsed.data.repsActual,
      weightActualKg: parsed.data.weightActualKg,
      rpe: parsed.data.rpe,
    });
  } catch (error) {
    console.error("[workout-log-set] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
