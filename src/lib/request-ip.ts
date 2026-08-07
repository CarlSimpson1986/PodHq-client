import type { NextRequest } from "next/server";

/**
 * Best-effort client IP for audit logging and rate limiting. Same logic as
 * podHq's request-ip.ts — see that file for the x-vercel-forwarded-for vs
 * x-forwarded-for rationale.
 */
export function getRequestIp(request: NextRequest): string | null {
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return request.headers.get("x-real-ip");
}
