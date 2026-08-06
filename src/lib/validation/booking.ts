import { z } from "zod";

export const createBookingSchema = z.object({
  slotStart: z.string().datetime(),
});
