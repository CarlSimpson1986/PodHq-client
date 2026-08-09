export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  priceGBP: number;
}

// PLACEHOLDER test-mode pricing, agreed 2026-08-09 — swap these numbers for
// real prices before going live. Nothing else needs to change: the checkout
// route and Stripe Checkout Session are built from this array at request
// time, not from pre-created Stripe Products/Prices.
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pack-5", label: "5 credits", credits: 5, priceGBP: 25 },
  { id: "pack-10", label: "10 credits", credits: 10, priceGBP: 45 },
  { id: "pack-20", label: "20 credits", credits: 20, priceGBP: 80 },
];
