import { z } from "zod";

// Optional — a missing/denied geolocation permission is itself grounds to
// block the unlock (see /api/unlock), not a validation error.
export const unlockSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
