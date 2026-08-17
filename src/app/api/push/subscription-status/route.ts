import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";

// Lets the client tell "browser permission granted" apart from "a
// subscription is actually saved" — those went out of sync in production
// once (VAPID keys missing there meant every subscribe attempt silently
// failed after the permission prompt already succeeded), permanently
// hiding the "Enable notifications" banner for anyone who'd hit that.
export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("member_id", member.id);

  if (error) {
    return NextResponse.json({ status: "error", message: "Could not check subscription." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", subscribed: (count ?? 0) > 0 });
}
