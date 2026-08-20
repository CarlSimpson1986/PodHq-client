export interface MembershipTier {
  id: string;
  // catalog_items' numeric PK — needed for coupon lookups (coupon_items
  // references this, not the text slug). See podHq's 0044_coupons.sql.
  catalogItemId: number;
  name: string;
  label: string;
  creditsPerPeriod: number;
  creditType: string;
  // Combo tiers only (e.g. Hove's Gym+Recovery Room package) — a second
  // credit grant from the same subscription. Null for every ordinary
  // tier. See podHq's 0042_catalog_items_combo_credits.sql.
  creditsPerPeriodSecondary: number | null;
  creditTypeSecondary: string | null;
  priceGBP: number;
}
