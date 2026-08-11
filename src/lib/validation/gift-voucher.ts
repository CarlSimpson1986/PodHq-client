import { z } from "zod";
import { VOUCHER_MIN_GBP, VOUCHER_MAX_GBP } from "@/lib/gift-voucher";

export const checkoutVoucherSchema = z.object({
  amountGBP: z.number().min(VOUCHER_MIN_GBP).max(VOUCHER_MAX_GBP),
});

export const redeemVoucherSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(20),
});
