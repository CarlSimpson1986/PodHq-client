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

  // Cross-gym waitlisting (2026-08-26): a resource no longer has to
  // belong to the member's own gym — no credit-eligibility check needed
  // here either, unlike /api/bookings. Joining a waitlist doesn't spend
  // anything; the real gate is create_booking()'s own credit-type check,
  // which only matters at the moment an offer is actually accepted.
  const { data: resource } = await admin
    .from("pod_resources")
    .select("id, gym, pod_capacity")
    .eq("id", parsed.data.resourceId)
    .maybeSingle();
  if (!resource) {
    return NextResponse.json({ status: "error", message: "Resource not found." }, { status: 404 });
  }

  // Only a genuinely full slot can be waitlisted — a member with an open
  // slot should just book it directly, not queue for something available.
  const { count: bookedCount } = await admin
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("resource_id", resource.id)
    .eq("slot_start", parsed.data.slotStart)
    .eq("status", "booked");

  if ((bookedCount ?? 0) < resource.pod_capacity) {
    return NextResponse.json(
      { status: "error", message: "That slot has space — book it directly instead." },
      { status: 409 }
    );
  }

  const { error } = await admin.from("waitlist_entries").insert({
    member_id: member.id,
    gym: resource.gym,
    resource_id: resource.id,
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
