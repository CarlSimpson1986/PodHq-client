import { z } from "zod";

export const checkoutMembershipSchema = z.object({
  tierId: z.string(),
});
