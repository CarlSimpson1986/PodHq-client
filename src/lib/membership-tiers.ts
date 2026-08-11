export interface MembershipTier {
  id: string;
  name: string;
  label: string;
  creditsPerPeriod: number;
  priceGBP: number;
}

// Real tiers, pulled directly from GymFlow's own Memberships admin list
// (Recurring tab) 2026-08-11 — only the enabled (Web+App on) rows. "Landlord"
// and "Landlord New" were left out: both are disabled on Web/App in GymFlow
// itself, so they read as internal/staff tiers, not real member offerings.
// Billed monthly, "Every 1 Month on Start Date" in GymFlow — matched here as
// a plain Stripe recurring subscription (interval: "month"), same dynamic
// price_data pattern as CREDIT_PACKAGES rather than pre-created Stripe
// Products/Prices.
export const MEMBERSHIP_TIERS: MembershipTier[] = [
  { id: "smart-save", name: "Smart Save", label: "1 credit / month", creditsPerPeriod: 1, priceGBP: 10.8 },
  { id: "5-sessions", name: "5 Sessions Per Month", label: "5 credits / month", creditsPerPeriod: 5, priceGBP: 60 },
  { id: "10-sessions", name: "10 Sessions Per Month", label: "10 credits / month", creditsPerPeriod: 10, priceGBP: 100 },
  { id: "20-sessions", name: "20 Session Pack", label: "20 credits / month", creditsPerPeriod: 20, priceGBP: 180 },
  { id: "30-sessions", name: "30 Sessions Per Month", label: "30 credits / month", creditsPerPeriod: 30, priceGBP: 240 },
];
