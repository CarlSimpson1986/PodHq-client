import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type DiscountType = "percentage" | "fixed";

export interface ApplicableCoupon {
  id: number;
  discountType: DiscountType;
  discountValue: number;
}

/**
 * Read-only lookup, no claiming — used to price the Checkout Session.
 * Case-insensitive by normalizing to uppercase (coupons are always
 * stored uppercase, see podHq's 0044_coupons.sql). Only returns a
 * coupon that's enabled and actually applies to this specific catalog
 * item — a code that exists but doesn't apply to what's being bought
 * looks identical to a code that doesn't exist at all, deliberately
 * (no information leak about which codes exist).
 */
export async function findApplicableCoupon(gym: string, code: string, catalogItemId: number): Promise<ApplicableCoupon | null> {
  const admin = createAdminClient();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const { data, error } = await admin
    .from("coupons")
    .select("id, discount_type, discount_value, coupon_items!inner(catalog_item_id)")
    .eq("gym", gym)
    .eq("code", normalized)
    .eq("enabled", true)
    .eq("coupon_items.catalog_item_id", catalogItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { id: data.id, discountType: data.discount_type, discountValue: data.discount_value };
}

/**
 * Atomically claims a redemption slot (respecting the coupon's own usage
 * limit type) via podHq's redeem_coupon() RPC — same shared-schema RPC
 * pattern as claim_membership_slot/create_booking. Called at Checkout
 * Session creation time, before payment; see 0044_coupons.sql's own
 * comment for the accepted abandoned-checkout tradeoff.
 */
export async function redeemCoupon(couponId: number, memberId: number, catalogItemId: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_coupon", {
    p_coupon_id: couponId,
    p_member_id: memberId,
    p_catalog_item_id: catalogItemId,
  });
  if (error) throw error;
  return data === true;
}

export function applyDiscount(priceGBP: number, coupon: ApplicableCoupon): number {
  const discounted = coupon.discountType === "percentage" ? priceGBP * (1 - coupon.discountValue / 100) : priceGBP - coupon.discountValue;
  return Math.max(0.5, discounted); // Stripe's own minimum charge floor for GBP
}
