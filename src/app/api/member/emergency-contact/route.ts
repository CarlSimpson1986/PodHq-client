import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/emergency-contact");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (name.length > 200 || phone.length > 50) {
    return NextResponse.json({ status: "error", message: "That doesn't look right — check the details." }, { status: 400 });
  }

  // Optional field — either both provided or both cleared, never one
  // half-set (an emergency contact with a name but no way to reach them,
  // or a number with no name, is useless in the moment it'd matter).
  if (Boolean(name) !== Boolean(phone)) {
    return NextResponse.json(
      { status: "error", message: "Enter both a name and phone number, or leave both blank." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({
      emergency_contact_name: name || null,
      emergency_contact_phone: phone || null,
    })
    .eq("id", member.id);

  if (error) {
    console.error("[member-emergency-contact] update failed", { error: error.message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
