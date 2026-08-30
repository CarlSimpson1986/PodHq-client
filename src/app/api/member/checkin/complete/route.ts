import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { completeCheckIn, getPreviousHabit } from "@/lib/coach/check-ins";
import { currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { getWeeklyReview } from "@/lib/coach/weekly-review";
import { narrateCheckInResponse, PAIN_ACKNOWLEDGMENT } from "@/lib/coach-bot";
import { checkRateLimit } from "@/lib/rate-limit";

// Matches the reflection-question set in checkin-view.tsx. Kept loose
// (no server-side "required" enforcement on the free-text fields) since
// check_ins.answers is deliberately schemaless jsonb — see 0054's own
// comment on why a fixed answers table wasn't built. weekFeel/hadPain/
// habit are the three the UI actually requires before enabling submit
// (habit added 2026-08-28 — it's read back by weekly-recommendation.ts/
// habit-streak.ts, so an empty habit would silently break both), all
// validated here too since the client-side requirement is only ever a
// UX nicety, never the real boundary. habitFollowUp (2026-08-30, client-
// perspective review) only ever appears alongside a real previousHabit —
// the UI only shows the question when one exists — so it's optional here
// too, not required.
const answersSchema = z.object({
  weekFeel: z.number().int().min(1).max(5),
  hadPain: z.boolean(),
  painDetail: z.string().max(500).optional(),
  barriers: z.string().max(500).optional(),
  habit: z.string().trim().min(1).max(200),
  habitFollowUp: z.enum(["yes", "partially", "no"]).optional(),
});

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/checkin/complete");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const coachProfile = await getCoachProfile(member.id);
  if (!coachProfile) {
    return NextResponse.json({ status: "error", message: "Set up your AI Coach first." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = answersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Answer the required questions first." }, { status: 400 });
  }

  // Read BEFORE completeCheckIn inserts this week's row below — this is
  // what makes it genuinely "last week's" habit, not the one just
  // submitted.
  let previousHabit: string | null = null;
  try {
    previousHabit = await getPreviousHabit(member.id);
  } catch (error) {
    console.error("[checkin-complete] failed to read previous habit", { error: (error as Error).message });
  }

  // Client-perspective review, 2026-08-30 — generated BEFORE the insert
  // now (was after, in a separate step that never got saved at all — see
  // coach-bot.ts's narrateCheckInResponse for why pain isn't part of it;
  // PAIN_ACKNOWLEDGMENT, fixed copy, covers that separately). A
  // Groq/Claude hiccup here must not fail the request — the check-in
  // itself still gets saved below either way, just without a
  // personalised response.
  let narrative: string | null = null;
  try {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    const review = await getWeeklyReview(member.id, periodStart, periodEnd, member.gender);
    narrative = await narrateCheckInResponse(member.name, review, {
      weekFeel: parsed.data.weekFeel,
      barriers: parsed.data.barriers,
      habit: parsed.data.habit,
      habitFollowUp: parsed.data.habitFollowUp,
      previousHabit,
    });
  } catch (error) {
    console.error("[checkin-complete] narration failed", { error: (error as Error).message });
  }

  const painAcknowledgment = parsed.data.hadPain ? PAIN_ACKNOWLEDGMENT : null;

  // Dashboard card, 2026-08-30 — narrative/painAcknowledgment used to be
  // returned once here and never saved anywhere at all: real, "should
  // this be actionable" feedback that vanished the moment the member
  // navigated away. Saved into the same schemaless answers jsonb as
  // everything else (see this file's own top comment on why there's no
  // fixed answers table) — getLatestCheckInResponse (check-ins.ts) reads
  // it back for the Home dashboard's CoachResponseCard.
  try {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    await completeCheckIn(member.id, periodStart, periodEnd, { ...parsed.data, narrative, painAcknowledgment });
  } catch (error) {
    console.error("[checkin-complete] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", narrative, painAcknowledgment });
}
