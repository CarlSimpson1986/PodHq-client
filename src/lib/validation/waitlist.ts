import { z } from "zod";

export const joinWaitlistSchema = z
  .object({
    resourceId: z.number().int().positive(),
    slotStart: z.string().datetime(),
  })
  .strict();
