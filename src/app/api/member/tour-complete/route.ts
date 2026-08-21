import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/tour-complete");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ tour_completed_at: new Date().toISOString() })
    .eq("id", member.id);

  if (error) {
    console.error("[member-tour-complete] update failed", { error: error.message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
