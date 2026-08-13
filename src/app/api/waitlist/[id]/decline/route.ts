import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { offerNextWaitlistEntry } from "@/lib/waitlist/offer-next";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/waitlist/decline");
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

  // Ownership doubles as the update's where-clause — declining someone
  // else's offer id simply matches zero rows.
  const { data: updated, error } = await admin
    .from("waitlist_entries")
    .update({ status: "declined" })
    .eq("id", id)
    .eq("member_id", member.id)
    .eq("status", "offered")
    .select("gym, slot_start");

  if (error) {
    console.error("[waitlist] decline failed", { entryId: id, error: error.message });
    return NextResponse.json({ status: "error", message: "Could not decline this offer." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ status: "error", message: "Offer not found or already resolved." }, { status: 404 });
  }

  // Cascade immediately rather than waiting for the next trigger (another
  // cancellation, or the daily cron safety-net) — a fast decline should
  // give the next waitlisted person their shot right away.
  await offerNextWaitlistEntry(updated[0].gym as string, updated[0].slot_start as string);

  return NextResponse.json({ status: "ok" });
}
