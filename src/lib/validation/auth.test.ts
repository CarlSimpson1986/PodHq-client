import { describe, it, expect } from "vitest";
import { signupSchema } from "./auth";

// Regression test for the multi-gym signup dropdown (2026-08-16) — gym went
// from a hardcoded PILOT_GYM constant to client-supplied input, so this is
// now a real trust boundary: an invalid/spoofed gym string must be rejected
// before it can reach the members table, not just filtered by the <select>
// options a browser happens to render.
describe("signupSchema", () => {
  const base = { email: "member@example.com", password: "Str0ngPass!", name: "Test Member" };

  it("accepts a real gym from the franchise list", () => {
    const result = signupSchema.safeParse({ ...base, gym: "Aylesbury Berryfields" });
    expect(result.success).toBe(true);
  });

  it("rejects a gym name not in the franchise list", () => {
    const result = signupSchema.safeParse({ ...base, gym: "Not A Real Gym" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing gym", () => {
    const result = signupSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown extra field (strict schema)", () => {
    const result = signupSchema.safeParse({ ...base, gym: "Aylesbury Berryfields", role: "admin" });
    expect(result.success).toBe(false);
  });
});
