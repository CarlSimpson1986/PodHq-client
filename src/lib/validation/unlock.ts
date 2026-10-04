import { z } from "zod";

// Optional — a missing/denied geolocation permission is itself grounds to
// block the unlock (see /api/unlock), not a validation error.
//
// bookingId is required as of 2026-08-17 (multiple bookable resources per
// gym) — the client now identifies exactly which booking it means to
// unlock, rather than the server inferring "the" active booking by time
// window alone (which was non-deterministic once a member could have two
// genuinely overlapping bookings across two different resources).
//
// door (2026-10-04, Hove): "entrance" opens the building's shared main
// door, only valid for a resource whose provider_config has an
// entranceDeviceId; "room" (the default, so every existing caller is
// unchanged) opens the resource's own door.
export const unlockSchema = z.object({
  bookingId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  door: z.enum(["entrance", "room"]).default("room"),
});
