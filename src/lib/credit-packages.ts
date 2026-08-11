export interface CreditPackage {
  id: string;
  name: string;
  label: string;
  credits: number;
  priceGBP: number;
}

// Real prices, pulled directly from GymFlow's own Credit Packs admin list
// (Independent Training [My Fit Pod - Aylesbury] category) 2026-08-11 —
// only the enabled (Web+App on) rows; the disabled duplicate "N Session
// Pack" one-offs and the £0 "Pay As You Go Entry" row were left out, since
// GymFlow itself doesn't sell those anymore (superseded by the recurring
// Memberships of the same name/price — see membership-tiers.ts). Nothing
// else needs to change: the checkout route and Stripe Checkout Session are
// built from this array at request time, not from pre-created Stripe
// Products/Prices.
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "intro-pack", name: "Intro Pack", label: "5 credits", credits: 5, priceGBP: 54 },
  { id: "smart-saver", name: "Smart Saver", label: "1 credit", credits: 1, priceGBP: 10.8 },
  { id: "train-solo-payg", name: "Train Solo PAYG", label: "1 credit", credits: 1, priceGBP: 13.5 },
  { id: "pt-pack-payg", name: "PT Pack PAYG", label: "1 credit", credits: 1, priceGBP: 17.5 },
  { id: "train-with-a-friend-payg", name: "Train With A Friend PAYG", label: "1 credit", credits: 1, priceGBP: 15 },
  { id: "train-with-your-team-payg", name: "Train With Your Team PAYG", label: "1 credit", credits: 1, priceGBP: 20 },
  { id: "pt-pack-10", name: "PT Pack — 10 Sessions", label: "10 credits", credits: 10, priceGBP: 150 },
  { id: "pt-pack-20", name: "PT Pack — 20 Visits", label: "20 credits", credits: 20, priceGBP: 250 },
  { id: "pt-pack-30", name: "PT Pack — 30 Visits", label: "30 credits", credits: 30, priceGBP: 300 },
];
