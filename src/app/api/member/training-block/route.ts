import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getBlockHistory } from "@/lib/coach/training-blocks";
import { getTrainingBlockState } from "@/lib/coach/training-block-state";
import { getTrainingBlockRecommendation } from "@/lib/coach/training-block-recommendation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/training-block");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  try {
    const coachProfile = await getCoachProfile(member.id);
    const now = new Date();
    const blockHistory = coachProfile ? await getBlockHistory(member.id) : [];
    const state = getTrainingBlockState(coachProfile, blockHistory, now);

    if (state.kind === "transition_due" && coachProfile) {
      const { recommendation, allowedBlockTypes } = await getTrainingBlockRecommendation(member.id, coachProfile, state, now);
      return NextResponse.json({ status: "ok", state, recommendation, allowedBlockTypes });
    }

    return NextResponse.json({ status: "ok", state, recommendation: null, allowedBlockTypes: [] });
  } catch (error) {
    console.error("[training-block] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
