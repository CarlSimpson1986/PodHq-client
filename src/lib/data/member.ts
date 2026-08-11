import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Member {
  id: number;
  auth_user_id: string;
  gym: string;
  name: string;
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

export interface CreditHistoryRow {
  id: number;
  amount: number;
  reason: "manual_grant" | "booking_used" | "booking_refund" | "purchase" | "membership" | "gift_voucher";
  created_at: string;
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

export async function getCreditBalance(memberId: number): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("credits").select("amount").eq("member_id", memberId);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
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

// Most recent first, capped — an append-only ledger has no natural upper
// bound otherwise, and Profile only needs enough to show recent activity,
// not a full accounting export.
export async function getCreditHistory(memberId: number, limit = 20): Promise<CreditHistoryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credits")
    .select("id, amount, reason, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
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
