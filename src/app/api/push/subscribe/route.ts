import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { pushSubscribeSchema } from "@/lib/validation/push";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/push/subscribe");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  // Upsert on endpoint (unique) — re-subscribing the same device (e.g.
  // after a browser data clear regenerated the same push endpoint) just
  // refreshes the keys rather than erroring or duplicating.
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      { member_id: member.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.p256dh, auth: parsed.data.auth },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("[push] failed to store subscription", { memberId: member.id, error: error.message });
    return NextResponse.json({ status: "error", message: "Could not save subscription." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
