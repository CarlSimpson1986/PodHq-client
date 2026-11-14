import { z } from "zod";
import { GYM_NAMES } from "@/lib/gym";

// Trimmed and lowercased everywhere (2026-11-14 review). Login used to take
// the email exactly as typed, but auth_events lookups are exact matches: a
// reset link logs its login_success under Supabase's lowercase address, so a
// member who'd typed "Tom@..." stayed hard-locked after using it. A trailing
// space from a keyboard suggestion also failed login outright.
const emailSchema = z.string().trim().toLowerCase().email();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

// Lower minimum than podHq's staff-account passwordSchema (12 chars) —
// decided 2026-08-09 for member accounts specifically, still requires
// upper/lower/number complexity.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(1).max(100),
    gym: z.enum(GYM_NAMES),
    // The unticked-by-default "email me tips and offers" box (lead
    // nurture, podHq 0106). Optional so an older cached client without
    // the box still signs up — as no consent.
    marketingConsent: z.boolean().optional(),
  })
  .strict();

export const requestPasswordResetSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
  })
  .strict();
