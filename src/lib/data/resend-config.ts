import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secret-encryption";

/**
 * Reads gym_resend_config, written by podHQ's admin-only Setup UI
 * (podHq's src/lib/data/resend-config.ts / 0037_gym_resend_config.sql) —
 * this app only ever reads it, never writes it. decryptSecret must stay
 * byte-for-byte identical to podHq's src/lib/crypto/secret-encryption.ts
 * (same SECRET_ENCRYPTION_KEY convention — see that file's own comment
 * for why this app needs its own copy rather than a shared package).
 */

export interface ResendConfig {
  apiKey: string;
  fromAddress: string;
  fromName: string;
}

/**
 * A gym with no row here has no error — it just means `sendEmail` should
 * fall back to the shared default account (see resend.ts), not that
 * something is broken.
 */
export async function getGymResendConfig(gym: string): Promise<ResendConfig | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gym_resend_config")
    .select("api_key_encrypted, from_address, from_name")
    .eq("gym", gym)
    .maybeSingle();

  if (error) {
    console.error("[resend-config] failed to read gym_resend_config", { gym, error: error.message });
    return null;
  }
  if (!data) return null;

  // decryptSecret throws (missing/malformed SECRET_ENCRYPTION_KEY, or
  // ciphertext that no longer matches it) rather than returning an error —
  // caught here, not left to propagate. Found 2026-09-02: an uncaught
  // throw here was reaching all the way up through sendEmail (whose own
  // docstring promises "never throws") into notifyFireAndForget and then
  // the calling route, crashing an otherwise-successful signup response
  // after the member/auth rows had already committed — the member got a
  // false "Something went wrong" while their account had actually been
  // created. Same "log and fall back to the shared account" treatment as
  // the query error above, not a rethrow.
  try {
    return {
      apiKey: decryptSecret(data.api_key_encrypted),
      fromAddress: data.from_address,
      fromName: data.from_name,
    };
  } catch (err) {
    console.error("[resend-config] failed to decrypt gym_resend_config", {
      gym,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}
