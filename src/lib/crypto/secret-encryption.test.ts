import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptSecret, decryptSecret } from "./secret-encryption";

describe("secret-encryption", () => {
  const originalKey = process.env.SECRET_ENCRYPTION_KEY;

  beforeAll(() => {
    // 32 raw bytes, base64-encoded — a fixed test key, never used outside
    // this suite.
    process.env.SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterAll(() => {
    process.env.SECRET_ENCRYPTION_KEY = originalKey;
  });

  it("round-trips a plaintext value", () => {
    const plaintext = "1//0eXampleRefreshToken";
    const ciphertext = encryptSecret(plaintext);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext instead of silently returning wrong data", () => {
    const ciphertext = encryptSecret("sensitive-token");
    const [iv, authTag, encrypted] = ciphertext.split(":");
    const tampered = `${iv}:${authTag}:${encrypted.slice(0, -4)}${encrypted.slice(-4) === "AAAA" ? "BBBB" : "AAAA"}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws on malformed ciphertext rather than returning garbage", () => {
    expect(() => decryptSecret("not-a-valid-ciphertext")).toThrow("Malformed ciphertext");
  });
});
