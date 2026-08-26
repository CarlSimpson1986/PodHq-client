import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Member {
  id: number;
  auth_user_id: string;
  gym: string;
  name: string;
  mobile_number: string | null;
  gender: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_postcode: string | null;
  waiver_signed_name: string | null;
  waiver_signed_at: string | null;
  // Hove's Founding Member offer — staff-granted in podHq (member profile
  // page), never automatic here. Grants 20% off every PAYG purchase; see
  // podHq's 0043_founding_member.sql.
  founding_member: boolean;
  // Set once the home-screen guided tour (driver.js) has been shown —
  // null means "never seen it", so it auto-launches once per member
  // regardless of device, then stays off. See 0045_member_tour.sql.
  tour_completed_at: string | null;
  // 7-day free AI Coach trial (Hove beta) — see 0047_member_trial.sql for
  // what each of the three stamps means. trial_activated_at alone means
  // "tapped Start my free trial but hasn't booked yet"; trial_started_at/
  // trial_expires_at are only set once, on the first booking after
  // activation (see the hook in bookings/route.ts).
  trial_activated_at: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  // Multi-site leaderboard (2026-08-25) — off by default; a member's
  // name/attendance/steps never appear to anyone else until they turn
  // this on themselves. See src/lib/coach/leaderboard.ts.
  leaderboard_opt_in: boolean;
}

// Gate for the physical door Unlock only (not booking/credits) — a member
// can still browse and book while completing this, but can't unlock until
// all three onboarding steps (contact, address, waiver) are done.
export function isAccessComplete(member: Member): boolean {
  return Boolean(
    member.mobile_number &&
      member.gender &&
      member.address_line1 &&
      member.address_city &&
      member.address_postcode &&
      member.waiver_signed_at
  );
}

export interface Booking {
  id: number;
  member_id: number;
  gym: string;
  resource_id: number;
  slot_start: string;
  status: "booked" | "cancelled" | "completed" | "no_show";
}

// One row per bookable resource — a gym can have more than one (see
// podHq's pod_resources, 0038_pod_resources.sql). creditType/
// accessProvider are plain strings here, not a closed TS union yet —
// Milestone 1 (Berkhamsted) never produces anything but 'pod'/'kisi'.
export interface PodResource {
  id: number;
  gym: string;
  resourceKey: string;
  label: string;
  creditType: string;
  slotDurationMinutes: number;
  accessProvider: string;
  podCapacity: number;
  openHour: number;
  closeHour: number;
}

export interface Membership {
  id: number;
  member_id: number;
  tier_id: string;
  tier_name: string;
  credits_per_period: number;
  stripe_subscription_id: string;
  status: "active" | "past_due" | "canceled";
  current_period_end: string | null;
}

// Verify the session with the caller's own client first (already done by
// every route/page that calls this), then query via the service-role
// client — matches podHq's documented lesson: never rely on RLS's
// auth.uid() as the actual authorization check, it has a real token-refresh
// timing gap that reads as "no data" rather than an error.
export async function getMemberByAuthUserId(authUserId: string): Promise<Member | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("members")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// Summed in Postgres via get_credit_balance() rather than pulling every
// ledger row and summing in JS — credits is append-only (one row per
// booking/purchase/renewal), so a long-tenured member's row count isn't
// bounded, and PostgREST silently truncates any single request past 1000
// rows. A truncated ledger fetch would mean a genuinely wrong balance,
// not just an incomplete list — this RPC returns one number regardless
// of how large the ledger gets, same pattern create_booking() already
// uses internally for its own balance check.
// creditType defaults to 'pod' — Milestone 1 never needs anything else;
// Brighton's Recovery-credit balance display passes it explicitly once
// that resource type exists.
export async function getCreditBalance(memberId: number, creditType = "pod"): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_credit_balance", { p_member_id: memberId, p_credit_type: creditType });

  if (error) throw new Error(error.message);
  return data ?? 0;
}

export async function getActiveMembership(memberId: number): Promise<Membership | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// AI Coach access (Hove beta): an active trial or any active paid
// membership grants the identical feature set — Silver/Gold/Platinum
// differ only by session-count allocation, not by AI Coach access, so
// this deliberately doesn't inspect which tier the membership is.
export async function hasPremium(member: Member): Promise<boolean> {
  if (member.trial_expires_at && new Date(member.trial_expires_at) > new Date()) {
    return true;
  }
  const membership = await getActiveMembership(member.id);
  return membership !== null;
}

// 65 min after slot_start (1hr slot + 5min grace) — matches
// bookings-view.tsx's own unlock-window grace period, so a booking that
// already started doesn't drop off Home right as the member arrives to
// actually unlock it.
const UNLOCK_WINDOW_AFTER_MS = 65 * 60 * 1000;

export async function getNextUpcomingBooking(memberId: number): Promise<Booking | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "booked")
    .gte("slot_start", new Date(Date.now() - UNLOCK_WINDOW_AFTER_MS).toISOString())
    .order("slot_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// Every booking this member has ever made, most recent slot first — small
// enough at pilot scale to fetch in one go and split into upcoming/past
// client-side, rather than two separate queries with fragile PostgREST
// filter-string construction for the "past" side's OR condition. Capped
// at 500 (most recent) rather than genuinely unbounded — a member visiting
// 3x/week for 3+ years would eventually approach PostgREST's silent
// 1000-row truncation cap otherwise. 500 is well beyond what this page's
// flat Upcoming/Past list is actually useful for browsing; a member who
// needs true full history beyond that is a real-pagination UI change, not
// a one-line fix.
export async function getAllMemberBookings(memberId: number): Promise<Booking[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("*")
    .eq("member_id", memberId)
    .order("slot_start", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface MemberWaitlistSlot {
  slotStart: string;
  resourceId: number;
}

// Slots this member is currently queued for (waiting or already offered) —
// small, member-scoped, no pagination concern. Used by /book to show
// "On waitlist" instead of "Join waitlist" on a slot they've already queued
// for. Includes resourceId — two resources can share a slot_start, and
// being queued on one must not show as "on waitlist" for the other.
export async function getMemberWaitlistSlots(memberId: number): Promise<MemberWaitlistSlot[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("waitlist_entries")
    .select("slot_start, resource_id")
    .eq("member_id", memberId)
    .in("status", ["waiting", "offered"]);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ slotStart: r.slot_start as string, resourceId: r.resource_id as number }));
}

export interface ActiveReservation {
  slot_start: string;
  member_id: number;
  resource_id: number;
}

// Slots on this day currently held for a specific waitlisted member (an
// active, non-expired offer) — used by /book so a slot with genuine
// physical space still shows as unavailable to everyone except the person
// it's actually reserved for, rather than a plain clickable "Book" that
// would only 409 for anyone else who tries it. Mirrors the same
// "computed, not stored" reservation check create_booking() itself uses
// (offer_expires_at checked live, never a stale cached status). Includes
// resource_id — a gym with more than one resource can have the same
// slot_start reserved on one resource but free on another.
export async function getActiveReservationsForDate(gym: string, date: Date): Promise<ActiveReservation[]> {
  const admin = createAdminClient();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data, error } = await admin
    .from("waitlist_entries")
    .select("slot_start, member_id, resource_id")
    .eq("gym", gym)
    .eq("status", "offered")
    .gt("offer_expires_at", new Date().toISOString())
    .gte("slot_start", startOfDay.toISOString())
    .lt("slot_start", endOfDay.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []) as ActiveReservation[];
}

export async function getBookingsForDate(gym: string, date: Date): Promise<Booking[]> {
  const admin = createAdminClient();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data, error } = await admin
    .from("bookings")
    .select("*")
    .eq("gym", gym)
    .eq("status", "booked")
    .gte("slot_start", startOfDay.toISOString())
    .lt("slot_start", endOfDay.toISOString())
    .order("slot_start", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Every bookable resource at this gym (podHq's admin "Pods" Calendar page
// configures these) — a gym with exactly one behaves exactly as before
// this feature existed; more than one means the booking grid shows a
// resource selector.
export async function getPodResourcesForGym(gym: string): Promise<PodResource[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pod_resources")
    .select("id, gym, resource_key, label, credit_type, slot_duration_minutes, access_provider, pod_capacity, open_hour, close_hour")
    .eq("gym", gym)
    .order("resource_key");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    gym: row.gym,
    resourceKey: row.resource_key,
    label: row.label,
    creditType: row.credit_type,
    slotDurationMinutes: row.slot_duration_minutes,
    accessProvider: row.access_provider,
    podCapacity: row.pod_capacity,
    openHour: row.open_hour,
    closeHour: row.close_hour,
  }));
}

// Not gym-scoped, unlike getPodResourcesForGym above — needed for the
// cross-gym PAYG booking flow (2026-08-26), where a resource's own gym
// isn't known to be the caller's gym in advance. Callers that need an
// IDOR-proofing check (a resource must belong to a specific gym) do that
// comparison themselves against the returned row's gym, same principle
// as every other ownership check in this app.
export async function getPodResourceById(resourceId: number): Promise<PodResource | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pod_resources")
    .select("id, gym, resource_key, label, credit_type, slot_duration_minutes, access_provider, pod_capacity, open_hour, close_hour")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    gym: data.gym,
    resourceKey: data.resource_key,
    label: data.label,
    creditType: data.credit_type,
    slotDurationMinutes: data.slot_duration_minutes,
    accessProvider: data.access_provider,
    podCapacity: data.pod_capacity,
    openHour: data.open_hour,
    closeHour: data.close_hour,
  };
}
