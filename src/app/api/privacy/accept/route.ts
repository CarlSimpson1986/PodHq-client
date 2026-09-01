import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { privacyConsentSchema } from "@/lib/validation/privacy-consent";

// Same non-null-timestamp-is-signed shape as /api/access/waiver — records
// explicit, timestamped consent before first Pod Coach use (see
// privacy-policy.ts's Section 8 and migration 0080's comment on why:
// AI-generated coaching advice carrying an insurance/liability record
// requirement, not just a general "read our policy" checkbox).
export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/privacy/accept");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = privacyConsentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: parsed.error.issues[0]?.message ?? "Check the details you entered." },
      { status: 400 }
    );
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ privacy_policy_accepted_at: new Date().toISOString() })
    .eq("id", member.id);

  if (error) {
    console.error("[privacy-accept] update failed", { error: error.message });
    return NextResponse.json({ status: "error", message: "Something went wrong. Try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
