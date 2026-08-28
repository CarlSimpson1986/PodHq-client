import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { completeCheckIn } from "@/lib/coach/check-ins";
import { currentCheckInPeriod } from "@/lib/coach/checkin-state";
import { checkRateLimit } from "@/lib/rate-limit";

// Matches the reflection-question set in checkin-view.tsx. Kept loose
// (no server-side "required" enforcement on the free-text fields) since
// check_ins.answers is deliberately schemaless jsonb — see 0054's own
// comment on why a fixed answers table wasn't built. weekFeel/hadPain are
// the two the UI actually requires before enabling submit; validated here
// too since the client-side requirement is only ever a UX nicety, never
// the real boundary.
const answersSchema = z.object({
  weekFeel: z.number().int().min(1).max(5),
  hadPain: z.boolean(),
  painDetail: z.string().max(500).optional(),
  barriers: z.string().max(500).optional(),
  nextWeekFocus: z.string().max(500).optional(),
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

  try {
    const { periodStart, periodEnd } = currentCheckInPeriod(new Date());
    await completeCheckIn(member.id, periodStart, periodEnd, parsed.data);
  } catch (error) {
    console.error("[checkin-complete] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
