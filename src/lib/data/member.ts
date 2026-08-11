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
  slot_start: string;
  status: "booked" | "cancelled" | "completed" | "no_show";
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
export async function getCreditBalance(memberId: number): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_credit_balance", { p_member_id: memberId });

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

export async function getNextUpcomingBooking(memberId: number): Promise<Booking | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "booked")
    .gte("slot_start", new Date().toISOString())
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

// Pod capacity + self-service booking hours (podHq's admin "Pods" page
// configures these per gym) — defaults to today's original behaviour
// (capacity 1, open all day) if the gym has no gym_kisi_mapping row at
// all, matching the DB column defaults.
export async function getPodConfig(gym: string): Promise<{ openHour: number; closeHour: number; podCapacity: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gym_kisi_mapping")
    .select("open_hour, close_hour, pod_capacity")
    .eq("gym", gym)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { openHour: data?.open_hour ?? 0, closeHour: data?.close_hour ?? 24, podCapacity: data?.pod_capacity ?? 1 };
}
