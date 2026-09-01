import { z } from "zod";

export const privacyConsentSchema = z.object({
  agreed: z.literal(true, { message: "You must accept the Privacy Policy to continue." }),
});
