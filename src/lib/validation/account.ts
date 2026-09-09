import { z } from "zod";

export const deleteAccountRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
  })
  .strict();
