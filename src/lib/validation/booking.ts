import { z } from "zod";

export const createBookingSchema = z.object({
  resourceId: z.number().int().positive(),
  slotStart: z.string().datetime(),
});

export const cancelBookingSchema = z.object({
  bookingId: z.number().int().positive(),
});
