import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";

// "Tap Start my free trial" — stamps trial_activated_at only. The trial
// clock itself (trial_started_at/trial_expires_at) doesn't start until
// the member actually finishes onboarding; see the hook in
// api/member/coach-profile/route.ts.
export async function POST() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/start-trial");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  // Idempotent — a member re-tapping the banner (or a retried request)
  // must not push trial_activated_at forward and delay nothing, since
  // trial_expires_at is derived from trial_started_at, not this stamp.
  if (!member.trial_activated_at) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("members")
      .update({ trial_activated_at: new Date().toISOString() })
      .eq("id", member.id);

    if (error) {
      console.error("[member-start-trial] update failed", { error: error.message });
      return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
    }
  }

  return NextResponse.json({ status: "ok" });
}
