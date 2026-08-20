import { z } from "zod";

export const checkoutSchema = z.object({
  packageId: z.string(),
  couponCode: z.string().min(1).max(30).optional(),
});
