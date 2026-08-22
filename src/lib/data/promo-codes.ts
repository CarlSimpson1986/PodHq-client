import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type DiscountType = "percentage" | "fixed";

export interface ApplicablePromoCode {
  id: number;
  discountType: DiscountType;
  discountValue: number;
}

/**
 * Read-only lookup, no claiming — used to price the Checkout Session.
 * Case-insensitive by normalizing to uppercase (codes are always
 * stored uppercase, see podHq's 0044_promo_codes.sql). Only returns a
 * code that's enabled and actually applies to this specific catalog
 * item — a code that exists but doesn't apply to what's being bought
 * looks identical to a code that doesn't exist at all, deliberately
 * (no information leak about which codes exist).
 */
export async function findApplicablePromoCode(gym: string, code: string, catalogItemId: number): Promise<ApplicablePromoCode | null> {
  const admin = createAdminClient();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const { data, error } = await admin
    .from("promo_codes")
    .select("id, discount_type, discount_value, promo_code_items!inner(catalog_item_id)")
    .eq("gym", gym)
    .eq("code", normalized)
    .eq("enabled", true)
    .eq("promo_code_items.catalog_item_id", catalogItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { id: data.id, discountType: data.discount_type, discountValue: data.discount_value };
}

/**
 * Atomically claims a redemption slot (respecting the code's own usage
 * limit type) via podHq's redeem_promo_code() RPC — same shared-schema RPC
 * pattern as claim_membership_slot/create_booking. Called at Checkout
 * Session creation time, before payment; see 0044_promo_codes.sql's own
 * comment for the accepted abandoned-checkout tradeoff.
 */
export async function redeemPromoCode(promoCodeId: number, memberId: number, catalogItemId: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_promo_code", {
    p_promo_code_id: promoCodeId,
    p_member_id: memberId,
    p_catalog_item_id: catalogItemId,
  });
  if (error) throw error;
  return data === true;
}

export function applyDiscount(priceGBP: number, promoCode: ApplicablePromoCode): number {
  const discounted =
    promoCode.discountType === "percentage" ? priceGBP * (1 - promoCode.discountValue / 100) : priceGBP - promoCode.discountValue;
  return Math.max(0.5, discounted); // Stripe's own minimum charge floor for GBP
}
