import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMemberContact } from "@/lib/notifications/resolve-member-contact";
import { notifyFireAndForget, appUrl } from "@/lib/notifications/core";
import { winBackEmail } from "@/lib/notifications/templates";

const INACTIVE_AFTER_DAYS = 21;
// Don't nudge the same member more than once a month even if they stay
// inactive — checked against notification_log, not a separate table.
const MIN_DAYS_BETWEEN_NUDGES = 30;
const PAGE_SIZE = 1000;

/**
 * Vercel Cron, once daily (same CRON_SECRET pattern as waitlist/expire).
 * Finds members whose most recent booking (booked or completed — not
 * cancelled) was more than INACTIVE_AFTER_DAYS ago and sends a one-off
 * "come back" nudge, skipping anyone already nudged within
 * MIN_DAYS_BETWEEN_NUDGES.
 *
 * A member whose latest qualifying booking is more than
 * INACTIVE_AFTER_DAYS in the past can't also have a future (upcoming)
 * booking — a future slot_start would itself be more recent and become
 * their "latest" instead — so there's no separate check needed to avoid
 * nudging someone who's already got their next session booked.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Paginate rather than trust one request — same lesson podHq's Revenue
  // queries learned the hard way (PostgREST silently caps at 1000 rows).
  const latestBookingByMember = new Map<number, string>();
  let from = 0;
  for (;;) {
    const { data: page, error } = await admin
      .from("bookings")
      .select("member_id, slot_start")
      .in("status", ["booked", "completed"])
      .order("slot_start", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[notifications] win-back sweep failed to query bookings", { error: error.message });
      return NextResponse.json({ status: "error", message: "Sweep failed." }, { status: 500 });
    }
    for (const row of page ?? []) {
      // Ascending order means the last write per member_id in this loop is
      // always their latest — no need to compare timestamps.
      latestBookingByMember.set(row.member_id, row.slot_start);
    }
    if (!page || page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const cutoff = Date.now() - INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const inactiveMemberIds = [...latestBookingByMember.entries()]
    .filter(([, slotStart]) => new Date(slotStart).getTime() < cutoff)
    .map(([memberId]) => memberId);

  let sent = 0;
  for (const memberId of inactiveMemberIds) {
    const nudgeCutoffIso = new Date(Date.now() - MIN_DAYS_BETWEEN_NUDGES * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentNudges } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("event_type", "win_back")
      .gte("created_at", nudgeCutoffIso);

    if (recentNudges && recentNudges > 0) continue;

    const contact = await resolveMemberContact(memberId);
    if (!contact) continue;

    const lastSlotStart = latestBookingByMember.get(memberId)!;
    const daysSinceLastVisit = Math.floor((Date.now() - new Date(lastSlotStart).getTime()) / (24 * 60 * 60 * 1000));

    const { subject, html } = winBackEmail({
      memberName: contact.name,
      gym: contact.gym,
      daysSinceLastVisit,
      bookUrl: `${appUrl()}/book`,
    });
    await notifyFireAndForget({ eventType: "win_back", to: contact.email, subject, html, memberId });
    sent++;
  }

  return NextResponse.json({ status: "ok", checked: inactiveMemberIds.length, sent });
}
