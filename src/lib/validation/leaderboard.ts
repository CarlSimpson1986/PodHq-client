import { z } from "zod";

export const leaderboardOptInSchema = z.object({
  optIn: z.boolean(),
});
