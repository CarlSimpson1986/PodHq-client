import crypto from "crypto";

// Presets match GymFlow's own Gift Voucher screen exactly (£20/50/100/150);
// a custom amount is also allowed, clamped to a sane range to stop the
// dynamic Stripe price_data being abused for a trivial or absurd amount.
export const VOUCHER_PRESETS_GBP = [20, 50, 100, 150];
export const VOUCHER_MIN_GBP = 10;
export const VOUCHER_MAX_GBP = 500;

// £10 = 1 credit — the best (cheapest) rate across the current PAYG packs
// (PT pack - 30 visits is £10/credit), used as a flat, documented
// conversion since vouchers span a range of £ amounts and there's no
// single canonical £-per-credit rate across all packs to derive this from.
// Rounds down so a voucher never grants a fraction of a credit or more
// credits than were actually paid for.
export const GBP_PER_CREDIT = 10;

export function creditsForVoucherAmount(amountGBP: number): number {
  return Math.floor(amountGBP / GBP_PER_CREDIT);
}

// Excludes visually ambiguous characters (0/O, 1/I/L) since this is
// read off a screen and typed back in by hand to redeem.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateVoucherCode(): string {
  const random = crypto.randomBytes(8);
  let chars = "";
  for (const byte of random) {
    chars += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}
