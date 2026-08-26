import { z } from "zod";

export const checkoutSchema = z.object({
  packageId: z.string(),
  promoCode: z.string().min(1).max(30).optional(),
  // Which gym's catalog price/Stripe account this purchase should use —
  // defaults to the member's own gym server-side if absent or not a real
  // gym name (see /api/checkout). Lets a member buying credit while
  // browsing another gym's /book (2026-08-26 cross-gym booking) price and
  // pay that gym, not always their home one.
  gym: z.string().min(1).max(100).optional(),
});
