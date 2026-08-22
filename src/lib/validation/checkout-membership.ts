import { z } from "zod";

export const checkoutMembershipSchema = z.object({
  tierId: z.string(),
  promoCode: z.string().min(1).max(30).optional(),
});
