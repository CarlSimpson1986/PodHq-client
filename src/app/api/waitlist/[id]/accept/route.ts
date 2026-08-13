import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/waitlist/accept");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ status: "error", message: "Invalid offer id." }, { status: 400 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Ownership + freshness check up front for a clear message — but
  // create_booking()'s own reservation check (0024_waitlist.sql) is the
  // real, race-free source of truth for whether this offer is still live;
  // this is just a better error message than a generic booking failure.
  const { data: entry } = await admin
    .from("waitlist_entries")
    .select("id, member_id, gym, slot_start, status, offer_expires_at")
    .eq("id", id)
    .maybeSingle();

  if (!entry || entry.member_id !== member.id) {
    return NextResponse.json({ status: "error", message: "Offer not found." }, { status: 404 });
  }
  if (entry.status !== "offered" || !entry.offer_expires_at || new Date(entry.offer_expires_at) < new Date()) {
    return NextResponse.json({ status: "error", message: "This offer has expired." }, { status: 409 });
  }

  const { data: bookingId, error } = await admin.rpc("create_booking", {
    p_member_id: member.id,
    p_gym: entry.gym,
    p_slot_start: entry.slot_start,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      return NextResponse.json({ status: "error", message: "Not enough credits to accept this slot." }, { status: 409 });
    }
    if (error.message.includes("slot_full") || error.message.includes("slot_reserved")) {
      return NextResponse.json({ status: "error", message: "This slot is no longer available." }, { status: 409 });
    }
    console.error("[waitlist] accept failed", { entryId: id, error: error.message });
    return NextResponse.json({ status: "error", message: "Could not accept this offer." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", bookingId });
}
