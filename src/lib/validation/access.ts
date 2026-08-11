import { z } from "zod";

export const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say", "Other"] as const;

// UK mobile only (this is a single-gym UK pilot) — 11 digits total
// (07xxxxxxxxx) or the +44 equivalent. Spaces are stripped before checking
// so however the member groups the digits when typing is fine.
const MOBILE_REGEX = /^(?:\+447\d{9}|07\d{9})$/;

export const accessContactSchema = z.object({
  mobileNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(MOBILE_REGEX, "Enter a valid UK mobile number.")),
  gender: z.enum(GENDER_OPTIONS),
});

// UK postcode — standard permissive pattern (covers all real formats
// without being strict enough to reject genuine edge-case postcodes).
const POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

export const accessAddressSchema = z.object({
  addressLine1: z.string().trim().min(1, "Enter your address.").max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  addressCity: z.string().trim().min(1, "Enter your town or city.").max(100),
  addressPostcode: z
    .string()
    .trim()
    .regex(POSTCODE_REGEX, "Enter a valid postcode.")
    .transform((v) => v.toUpperCase()),
});

export const accessWaiverSchema = z.object({
  signedName: z.string().trim().min(2, "Type your full name to sign.").max(200),
  agreed: z.literal(true, { message: "You must agree to the waiver to continue." }),
});
