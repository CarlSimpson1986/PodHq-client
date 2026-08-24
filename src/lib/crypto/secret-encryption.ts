import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM helpers for third-party secrets that must be stored (not
 * just hashed) because the app needs the real plaintext back to call an
 * external API with it — a member's Fitbit/Google Health refresh token
 * (src/lib/data/wearables.ts). Hashing (one-way) doesn't fit that case;
 * this is reversible, keyed by a server-only secret that never touches
 * the database. Byte-for-byte identical to podHq's src/lib/crypto/
 * secret-encryption.ts (same SECRET_ENCRYPTION_KEY convention, but this
 * app needs its own copy since the two apps are separate deploys/repos,
 * not a shared package) — unlike podHq's version, this app is both the
 * writer (OAuth callback) and reader (sync cron) for this particular
 * secret, so it needs the full encrypt/decrypt pair, not decrypt-only
 * (see src/lib/data/resend-config.ts for the decrypt-only case).
 *
 * SECRET_ENCRYPTION_KEY must be a 32-byte key, base64-encoded (e.g.
 * `openssl rand -base64 32`). Ciphertext is stored as
 * base64(iv) + ":" + base64(authTag) + ":" + base64(encrypted).
 */
function getKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SECRET_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("Malformed ciphertext");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
