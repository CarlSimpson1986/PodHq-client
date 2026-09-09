import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { sendPush } from "@/lib/push/send";

// TEMPORARY, self-service only (2026-09-09) -- lets a signed-in member
// send themselves one real test push through the exact same sendPush()
// path the waitlist trigger uses, to verify actual delivery end-to-end
// without fabricating a real waitlist scenario in production booking
// data. No admin bypass, no arbitrary target -- always sends to whoever
// is calling this, signed in as themselves. Remove once push delivery is
// confirmed working.
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

  const result = await sendPush({
    memberId: member.id,
    title: "Test push",
    body: "This is a real test push from PodHQ Client.",
    url: "/bookings",
  });

  return NextResponse.json({ status: "ok", result });
}
