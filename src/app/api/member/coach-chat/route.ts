import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getTrainingBlockState } from "@/lib/coach/training-block-state";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getRecoveryStatus } from "@/lib/coach/recovery-status";
import { getLastCompletedSessionDetail } from "@/lib/coach/exercise-performance";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { askCoach } from "@/lib/coach/coach-chat";
import { getAvoidedExercisesWithNames } from "@/lib/coach/avoided-exercises";
import { appendCoachConversationTurn } from "@/lib/coach/coach-conversations";
import { coachChatSchema } from "@/lib/validation/coach-chat";

// Same limit as help-chat — this also hits an LLM provider per message.
const COACH_CHAT_LIMIT_PER_MINUTE = 15;

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/coach-chat", COACH_CHAT_LIMIT_PER_MINUTE);
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many messages. Wait a moment and try again." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  if (!(await hasPremium(member))) {
    return NextResponse.json({ status: "error", message: "AI Coach chat needs an active membership or trial." }, { status: 403 });
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    return NextResponse.json({ status: "error", message: "Set up your AI Coach profile first." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = coachChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  try {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    const [blockHistory, recoveryStatus, lastSession, weeklyReview, avoidedExercises] = await Promise.all([
      getBlockHistory(member.id),
      getRecoveryStatus(member.id),
      getLastCompletedSessionDetail(member.id),
      getWeeklyReview(member.id, periodStart, periodEnd, member.gender),
      getAvoidedExercisesWithNames(member.id),
    ]);
    const blockState = getTrainingBlockState(coachProfile, blockHistory, new Date());

    const reply = await askCoach(
      {
        memberName: member.name,
        goal: coachProfile.goal,
        experienceLevel: coachProfile.experience_level,
        blockState,
        recoveryStatus,
        lastSession,
        weeklyReview,
        injuries: coachProfile.injuries,
        avoidedExerciseNames: avoidedExercises.map((e) => e.name),
      },
      parsed.data.message,
      parsed.data.history
    );

    const now = new Date().toISOString();
    await appendCoachConversationTurn(
      member.id,
      { role: "user", content: parsed.data.message, timestamp: now },
      { role: "assistant", content: reply, timestamp: now }
    );

    return NextResponse.json({ status: "ok", reply });
  } catch (error) {
    console.error("[coach-chat] askCoach failed", { memberId: member.id, error: error instanceof Error ? error.message : error });
    return NextResponse.json({ status: "error", message: "Coach is having trouble right now. Try again shortly." }, { status: 500 });
  }
}
