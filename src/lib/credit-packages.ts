export interface CreditPackage {
  id: string;
  name: string;
  label: string;
  credits: number;
  priceGBP: number;
}

// PLACEHOLDER test-mode pricing and names, agreed 2026-08-09 — swap these
// numbers for real prices before going live. Names added 2026-08-10 to
// match GymFlow's own Credit Packs card pattern (named packs, not just a
// bare quantity), which members already know from that app. Nothing else
// needs to change: the checkout route and Stripe Checkout Session are
// built from this array at request time, not from pre-created Stripe
// Products/Prices.
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pack-5", name: "Starter", label: "5 credits", credits: 5, priceGBP: 25 },
  { id: "pack-10", name: "Regular", label: "10 credits", credits: 10, priceGBP: 45 },
  { id: "pack-20", name: "Best Value", label: "20 credits", credits: 20, priceGBP: 80 },
];
