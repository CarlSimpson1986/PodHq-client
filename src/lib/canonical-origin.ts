import type { NextRequest } from "next/server";

export const PRODUCTION_ORIGIN = "https://www.myfitpod.app";

/**
 * Origin to embed in long-lived links (email confirmation, password reset).
 * request.nextUrl.origin alone bakes in whatever host the request happened
 * to arrive on — including a stale/removed Vercel alias (podhq-client.vercel.app
 * now returns 404 DEPLOYMENT_NOT_FOUND) if that's what the user was on when
 * they signed up, producing a confirmation link that 404s. In production,
 * always use the real custom domain regardless of the request's own host;
 * local dev and Vercel preview deployments still want their own origin.
 */
export function getCanonicalOrigin(request: NextRequest): string {
  return process.env.VERCEL_ENV === "production" ? PRODUCTION_ORIGIN : request.nextUrl.origin;
}
