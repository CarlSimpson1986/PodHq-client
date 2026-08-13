import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { joinWaitlistSchema } from "@/lib/validation/waitlist";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/waitlist");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = joinWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Only a genuinely full slot can be waitlisted — a member with an open
  // slot should just book it directly, not queue for something available.
  const { data: config } = await admin
    .from("gym_kisi_mapping")
    .select("pod_capacity")
    .eq("gym", member.gym)
    .maybeSingle();
  const capacity = config?.pod_capacity ?? 1;

  const { count: bookedCount } = await admin
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("gym", member.gym)
    .eq("slot_start", parsed.data.slotStart)
    .eq("status", "booked");

  if ((bookedCount ?? 0) < capacity) {
    return NextResponse.json(
      { status: "error", message: "That slot has space — book it directly instead." },
      { status: 409 }
    );
  }

  const { error } = await admin.from("waitlist_entries").insert({
    member_id: member.id,
    gym: member.gym,
    slot_start: parsed.data.slotStart,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ status: "error", message: "You're already on the waitlist for this slot." }, { status: 409 });
    }
    console.error("[waitlist] failed to join", { memberId: member.id, error: error.message });
    return NextResponse.json({ status: "error", message: "Could not join the waitlist." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
