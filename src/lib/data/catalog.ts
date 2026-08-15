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
    .select("item_id, name, label, credits, price_gbp")
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
    priceGBP: row.price_gbp,
  }));
}

export async function getMembershipTiers(gym: string): Promise<MembershipTier[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("catalog_items")
    .select("item_id, name, label, credits, price_gbp")
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
