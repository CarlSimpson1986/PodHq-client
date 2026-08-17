import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreditPackage } from "@/lib/credit-packages";
import type { MembershipTier } from "@/lib/membership-tiers";

// Reads the same catalog_items table podHq's Setup page (owner-only,
// per-gym) writes to (0029/0031/0032 in podHq's migrations folder) —
// replaces this app's own hardcoded CREDIT_PACKAGES/MEMBERSHIP_TIERS
// arrays as of 2026-08-15, so a price change an owner makes in Setup shows
// up here immediately, no deploy needed. Gym-scoped: each gym has its own
// independent prices, same as every other per-gym feature in this app.
// Mapped into the pre-existing CreditPackage/MembershipTier shapes rather
// than changing every consumer (buy-credits/buy-membership pages,
// /api/checkout, /api/checkout-membership) to a new interface.

export async function getCreditPackages(gym: string): Promise<CreditPackage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("catalog_items")
    .select("item_id, name, label, credits, credit_type, price_gbp, one_time_per_member")
    .eq("gym", gym)
    .eq("type", "credit_pack")
    .eq("enabled", true)
    .order("price_gbp");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.item_id,
    name: row.name,
    label: row.label,
    credits: row.credits,
    creditType: row.credit_type,
    priceGBP: row.price_gbp,
    oneTimePerMember: row.one_time_per_member,
  }));
}

/** Which of this member's one-time-per-member items they've already claimed — catalog_item_id set on any credits row they've ever received. */
export async function getClaimedOneTimeItemIds(memberId: number): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("credits").select("catalog_item_id").eq("member_id", memberId).not("catalog_item_id", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.catalog_item_id as string));
}

/** Server-side enforcement for a single item at checkout time — self-service purchase only, staff-initiated sales in podHq are deliberately exempt. */
export async function hasMemberClaimedItem(memberId: number, itemId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("credits")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("catalog_item_id", itemId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function getMembershipTiers(gym: string): Promise<MembershipTier[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("catalog_items")
    .select("item_id, name, label, credits, credit_type, price_gbp")
    .eq("gym", gym)
    .eq("type", "membership")
    .eq("enabled", true)
    .order("price_gbp");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.item_id,
    name: row.name,
    label: row.label,
    creditsPerPeriod: row.credits,
    creditType: row.credit_type,
    priceGBP: row.price_gbp,
  }));
}

/** Validates a submitted packageId server-side (checkout routes) — enabled-only, same as what's actually offered, scoped to the member's own gym. */
export async function getCreditPackageById(gym: string, packageId: string): Promise<CreditPackage | null> {
  const packages = await getCreditPackages(gym);
  return packages.find((p) => p.id === packageId) ?? null;
}

/** Validates a submitted tierId server-side (checkout routes) — enabled-only, same as what's actually offered, scoped to the member's own gym. */
export async function getMembershipTierById(gym: string, tierId: string): Promise<MembershipTier | null> {
  const tiers = await getMembershipTiers(gym);
  return tiers.find((t) => t.id === tierId) ?? null;
}
