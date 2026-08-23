import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getCoachProfile } from "@/lib/coach/coach-profile";
import { getBlockHistory, startBlock } from "@/lib/coach/training-blocks";
import { getTrainingBlockState } from "@/lib/coach/training-block-state";
import { getTrainingBlockRecommendation } from "@/lib/coach/training-block-recommendation";
import { confirmTrainingBlockSchema } from "@/lib/validation/training-block";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/training-block/confirm");
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = confirmTrainingBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const now = new Date();
    const blockHistory = await getBlockHistory(member.id);
    const state = getTrainingBlockState(coachProfile, blockHistory, now);

    // Double-submit guard: re-derive the state fresh, server-side,
    // immediately before writing. If it's already moved off
    // transition_due (this member's own second tap, or a stale client),
    // no-op rather than trust the client's copy of what was due.
    if (state.kind !== "transition_due") {
      return NextResponse.json({ status: "ok", noop: true });
    }

    // Never trusts the client's copy of what was offered — recompute the
    // recommendation from live data and reject any chosenBlockType that
    // isn't one of the options this recommendation actually allows.
    const { allowedBlockTypes } = await getTrainingBlockRecommendation(member.id, coachProfile, state, now);
    if (!allowedBlockTypes.includes(parsed.data.chosenBlockType)) {
      return NextResponse.json({ status: "error", message: "That option isn't available right now." }, { status: 400 });
    }

    await startBlock(member.id, parsed.data.chosenBlockType);
    return NextResponse.json({ status: "ok", noop: false });
  } catch (error) {
    console.error("[training-block-confirm] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
