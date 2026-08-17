import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { offerNextWaitlistEntry } from "@/lib/waitlist/offer-next";

/**
 * Safety-net sweep — Vercel Cron hits this once a day (Hobby plan's
 * minimum interval; per-minute cadence needs Pro). Real-time responsiveness
 * doesn't depend on this running often: create_booking()'s own
 * offer_expires_at check (0024_waitlist.sql) means an expired offer stops
 * blocking the slot immediately regardless of whether this route has run,
 * and offerNextWaitlistEntry() also gets called opportunistically from the
 * cancel route and the decline route. This just catches anything nothing
 * else happened to trigger — a slot whose offeree never responded and
 * nobody else cancelled or declined anything else that day.
 *
 * Authenticated via CRON_SECRET (Vercel sends this as a bearer token to
 * cron-invoked routes) rather than a member session — there's no user
 * making this request.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed if the secret itself is missing (misconfigured env) rather
  // than comparing against the literal string "Bearer undefined" — found in
  // the 2026-08-16 OWASP audit: a request that sends that exact header would
  // otherwise pass.
  if (!cronSecret) {
    console.error("[waitlist] CRON_SECRET is not configured");
    return NextResponse.json({ status: "error", message: "Not configured." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: staleOffers, error } = await admin
    .from("waitlist_entries")
    .select("resource_id, slot_start")
    .eq("status", "offered")
    .lt("offer_expires_at", nowIso);

  if (error) {
    console.error("[waitlist] expire sweep failed to query", { error: error.message });
    return NextResponse.json({ status: "error", message: "Sweep failed." }, { status: 500 });
  }

  const uniqueSlots = new Map<string, { resourceId: number; slotStart: string }>();
  for (const row of staleOffers ?? []) {
    uniqueSlots.set(`${row.resource_id}|${row.slot_start}`, { resourceId: row.resource_id as number, slotStart: row.slot_start as string });
  }

  for (const { resourceId, slotStart } of uniqueSlots.values()) {
    // offerNextWaitlistEntry itself expires the stale row before offering
    // the next person — one call handles both steps for each slot.
    await offerNextWaitlistEntry(resourceId, slotStart);
  }

  return NextResponse.json({ status: "ok", processed: uniqueSlots.size });
}
