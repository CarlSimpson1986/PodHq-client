import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMemberContact } from "@/lib/notifications/resolve-member-contact";
import { notifyFireAndForget, appUrl } from "@/lib/notifications/core";
import { trainingNudgeEmail } from "@/lib/notifications/templates";
import { trainingNudgeThresholdDays } from "@/lib/notifications/training-nudge-threshold";
import { DEFAULT_WEEKLY_TARGET } from "@/lib/coach/leaderboard";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAYS_BETWEEN_NUDGES = 14;
const PAGE_SIZE = 1000;

/**
 * Vercel Cron, once daily — same CRON_SECRET/pagination/dedup shape as
 * win-back/route.ts, but personalised rather than a flat 21 days.
 * Complementary to win-back, not a replacement: win-back catches "hasn't
 * booked anything in ages" off bookings.status; this catches "training
 * less than their own normal pace" off pod_access_events.success — a
 * real Kisi door unlock, the same cheat-proof signal the leaderboard
 * uses (bookings.status never actually transitions to 'completed'
 * anywhere in this codebase, confirmed 2026-08-25, so it can't be
 * trusted as an attendance signal). Deliberately excludes members who've
 * never once trained — they're covered by win-back's booking-based
 * threshold instead, not "fell off pace" (there's no pace to fall off
 * yet). sessions_per_week comes from coach_profiles when it exists,
 * DEFAULT_WEEKLY_TARGET otherwise — same fallback the leaderboard's
 * streak calculation already uses, for the same reason.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[notifications] CRON_SECRET is not configured");
    return NextResponse.json({ status: "error", message: "Not configured." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Most recent successful unlock per member, paginated the same way
  // win-back paginates bookings (PostgREST silently caps at 1000 rows).
  const lastSessionByMember = new Map<number, string>();
  let from = 0;
  for (;;) {
    const { data: page, error } = await admin
      .from("pod_access_events")
      .select("member_id, attempted_at")
      .eq("success", true)
      .order("attempted_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[notifications] training-nudge sweep failed to query pod_access_events", { error: error.message });
      return NextResponse.json({ status: "error", message: "Sweep failed." }, { status: 500 });
    }
    for (const row of page ?? []) {
      // Ascending order means the last write per member_id is always
      // their most recent successful unlock — no timestamp comparison needed.
      lastSessionByMember.set(row.member_id, row.attempted_at);
    }
    if (!page || page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (lastSessionByMember.size === 0) {
    return NextResponse.json({ status: "ok", checked: 0, sent: 0 });
  }

  const { data: profiles, error: profilesError } = await admin
    .from("coach_profiles")
    .select("member_id, sessions_per_week")
    .in("member_id", [...lastSessionByMember.keys()]);
  if (profilesError) {
    console.error("[notifications] training-nudge sweep failed to query coach_profiles", { error: profilesError.message });
    return NextResponse.json({ status: "error", message: "Sweep failed." }, { status: 500 });
  }
  const targetByMember = new Map<number, number>((profiles ?? []).map((p) => [p.member_id, p.sessions_per_week]));

  const now = Date.now();
  let checked = 0;
  let sent = 0;

  for (const [memberId, lastSessionAt] of lastSessionByMember) {
    const target = targetByMember.get(memberId) ?? DEFAULT_WEEKLY_TARGET;
    const nudgeThresholdDays = trainingNudgeThresholdDays(target);

    const daysSinceLastSession = Math.floor((now - new Date(lastSessionAt).getTime()) / MS_PER_DAY);
    if (daysSinceLastSession < nudgeThresholdDays) continue;
    checked++;

    const nudgeCutoffIso = new Date(now - MIN_DAYS_BETWEEN_NUDGES * MS_PER_DAY).toISOString();
    const { count: recentNudges } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("event_type", "training_nudge")
      .gte("created_at", nudgeCutoffIso);

    if (recentNudges && recentNudges > 0) continue;

    const contact = await resolveMemberContact(memberId);
    if (!contact) continue;

    const { subject, html } = trainingNudgeEmail({
      memberName: contact.name,
      gym: contact.gym,
      daysSinceLastSession,
      bookUrl: `${appUrl()}/book`,
    });
    await notifyFireAndForget({ eventType: "training_nudge", to: contact.email, subject, html, memberId, gym: contact.gym });
    sent++;
  }

  return NextResponse.json({ status: "ok", checked, sent });
}
