import { z } from "zod";
import { GYM_NAMES } from "@/lib/gym";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const emailSchema = z.string().trim().toLowerCase().email();

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
