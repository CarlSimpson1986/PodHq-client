import { z } from "zod";

export const joinWaitlistSchema = z
  .object({
    slotStart: z.string().datetime(),
  })
  .strict();
