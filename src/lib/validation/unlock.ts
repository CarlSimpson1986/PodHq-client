import { z } from "zod";

// Optional — a missing/denied geolocation permission is itself grounds to
// block the unlock (see /api/unlock), not a validation error.
//
// bookingId is required as of 2026-08-17 (multiple bookable resources per
// gym) — the client now identifies exactly which booking it means to
// unlock, rather than the server inferring "the" active booking by time
// window alone (which was non-deterministic once a member could have two
// genuinely overlapping bookings across two different resources).
export const unlockSchema = z.object({
  bookingId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
