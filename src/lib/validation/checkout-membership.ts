import { z } from "zod";

export const checkoutMembershipSchema = z.object({
  tierId: z.string(),
  couponCode: z.string().min(1).max(30).optional(),
});
