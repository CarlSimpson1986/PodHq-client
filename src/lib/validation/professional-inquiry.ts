import { z } from "zod";

export const professionalInquirySchema = z
  .object({
    professionalId: z.number().int().positive(),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();
