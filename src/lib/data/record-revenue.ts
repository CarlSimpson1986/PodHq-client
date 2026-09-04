import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Writes a real Stripe transaction into the pre-existing Revenue table
// (owned by podHq's dashboard, historically fed only by the GymFlow CSV
// pipeline — see podHq's ROADMAP.md) for a gym on the standalone Stripe
// path (0084_gym_stripe_standalone.sql). Confirmed safe with Carl,
// 2026-09-04: a standalone gym's own Stripe account replaces GymFlow's
// role for that revenue entirely — there is no overlapping GymFlow feed
// to double-count against, unlike a franchisee gym still on Connect/the
// shared platform, which stays GymFlow-only and must never get a row
// written here.
//
// Called only from within the same `if (!error)` "was this insert
// actually fresh, not a retried webhook delivery" gates the caller
// already uses for credits/memberships — that's this table's only
// idempotency guard, since (unlike credits/gift_vouchers) Revenue has no
// stripe_event_id column of its own to de-dupe on directly. Don't call
// this from anywhere that isn't already behind one of those gates.
export async function recordStripeRevenue(
  gym: string,
  item: string,
  amountIncTaxGBP: number,
  category: "MEMBERSHIP" | "CREDIT_PACK",
  soldTo: string,
  eventCreatedUnix: number
): Promise<void> {
  const admin = createAdminClient();
  const date = new Date(eventCreatedUnix * 1000);
  const reportMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  const { error } = await admin.from("Revenue").insert({
    gym,
    date: date.toISOString(),
    item,
    quantity_sold: 1,
    amount_inc_tax: amountIncTaxGBP,
    category,
    sold_to: soldTo,
    report_month: reportMonth,
  });

  if (error) {
    console.error("[record-revenue] failed to insert Revenue row", { gym, item, error: error.message });
  }
}
