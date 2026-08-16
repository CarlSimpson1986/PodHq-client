import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDecipheriv } from "crypto";

/**
 * Reads gym_resend_config, written by podHQ's admin-only Setup UI
 * (podHq's src/lib/data/resend-config.ts / 0037_gym_resend_config.sql) —
 * this app only ever reads it, never writes it. Decrypt logic must stay
 * byte-for-byte identical to podHq's src/lib/crypto/secret-encryption.ts
 * (same SECRET_ENCRYPTION_KEY convention, but podhq-client needs its own
 * copy since the two apps are separate deploys/repos, not a shared
 * package) — AES-256-GCM, ciphertext stored as
 * base64(iv):base64(authTag):base64(encrypted).
 */
function decryptSecret(ciphertext: string): string {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) throw new Error("SECRET_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

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

  return {
    apiKey: decryptSecret(data.api_key_encrypted),
    fromAddress: data.from_address,
    fromName: data.from_name,
  };
}
