import { z } from "zod";

export const checkoutSchema = z.object({
  packageId: z.string(),
});
