import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /offline is the service worker's navigation fallback (see public/sw.js) —
// it must be reachable and precache-able without a session, otherwise a
// logged-out member on a dead connection would get bounced in a redirect
// loop instead of seeing it, and the SW's install-time cache.addAll would
// fail on the 307 it'd otherwise get back.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/callback", "/offline"];
// /api/webhooks/ is called by Stripe's servers, not a member's browser —
// there's no session cookie to check, so the auth gate below must not
// redirect it to /login (the route authenticates via Stripe's own
// signature instead, see src/app/api/webhooks/stripe/route.ts).
//
// /api/waitlist/expire and /api/notifications/win-back are the same story
// but for Vercel Cron: no session cookie either, authenticated via
// CRON_SECRET inside the route itself. Found live 2026-08-14 while testing
// the new win-back route — it (and the pre-existing waitlist/expire cron)
// were being silently redirected to /login by this same gate before ever
// reaching their own auth check, meaning the daily waitlist-expiry sweep
// had likely never actually run since it was built.
//
// Listed as exact paths, not a "/api/notifications/" prefix — found in the
// 2026-08-16 OWASP audit: a prefix here means any future route added under
// that path skips this gate entirely by default, relying solely on that
// route remembering its own auth check. An exact-path allowlist makes a new
// cron route an explicit opt-in instead.
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/webhooks/"];
// /api/health has no session to check either — an external uptime monitor
// hits it directly, same reasoning as the cron routes above.
//
// /api/wearables/sync is the same story — Vercel Cron calls it with no
// session cookie, authenticated via CRON_SECRET inside the route itself.
// Learned from the 2026-08-14 incident above: added here up front rather
// than discovered later via a cron that silently never actually ran.
const PUBLIC_API_EXACT_PATHS = [
  "/api/waitlist/expire",
  "/api/notifications/win-back",
  "/api/notifications/training-nudge",
  "/api/health",
  "/api/wearables/sync",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_API_EXACT_PATHS.includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const isDev = process.env.NODE_ENV === "development";

// Nonce-based CSP, same approach as podHq's proxy.ts (see that file for
// the full 'unsafe-inline' vs nonce rationale: 'unsafe-inline' was the
// only thing standing between a broken, unhydrated login page and a
// working one there, because Next's own inline hydration scripts were
// getting silently blocked with no console warning). Simpler than podHq's
// here — no Turnstile/captcha widget, and this app makes no client-side
// Supabase calls (CLAUDE.md: all Supabase access goes through API routes),
// so there's no need for extra script-src/connect-src/frame-src allowances.
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    // fcm.googleapis.com — Chrome's Push API routes pushManager.subscribe()
    // through its push service over a real network connection from the
    // page's own process, which page CSP does govern (same class of gap as
    // podHq's Turnstile CSP miss and this app's own Stripe-embedded-Checkout
    // CSP miss — a third-party integration needing an explicit allowance
    // that a plain 'self' connect-src silently blocks with no obvious error
    // pointing at the real cause).
    "connect-src 'self' https://fcm.googleapis.com",
    // youtube-nocookie.com (not youtube.com) — YouTube's privacy-enhanced
    // embed domain, no tracking cookies set until the member actually
    // presses play. Added for per-exercise technique videos on the
    // workout screen (Carl-curated links, not auto-selected).
    "frame-src https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Explicit rather than relying on the script-src/default-src fallback —
    // the same "silently blocked, zero console warning" failure mode this
    // codebase already hit once with Permissions-Policy's geolocation=()
    // is worth guarding against defensively here too, for the waitlist
    // push-notification service worker.
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");
}

// Pilot-scope simplification vs. podHq's proxy.ts: no MFA, no lockout, no
// forced-password-change gate — a single throwaway test account, not real
// member onboarding. Revisit before this handles real members.
// Named `proxy` (not `middleware`) per Next 16's renamed convention —
// `middleware.ts` still works but is deprecated as of this version.
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  request.headers.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase server environment variables are not configured");
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: true,
            // "lax", not "strict" — the Stripe Checkout success redirect
            // (Stage 4) is a cross-site top-level GET navigation back into
            // this app, and Strict cookies are withheld from exactly that
            // request, which silently logged the member out on return.
            // Lax still blocks cross-site POST/CSRF, just not this GET.
            sameSite: "lax",
          })
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  let response: NextResponse;
  if (!user) {
    response = isPublic ? supabaseResponse : NextResponse.redirect(new URL("/login", request.url));
  } else if (pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot-password")) {
    response = NextResponse.redirect(new URL("/book", request.url));
  } else {
    response = supabaseResponse;
  }

  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    // Exclude static-asset extensions so an unauthenticated request for
    // e.g. a PWA icon or manifest doesn't get 307'd to /login the way
    // podHq's logo did before this same fix there (see its proxy.ts).
    // sw.js is named explicitly (not just by extension) so the service
    // worker script itself is always served plainly, regardless of auth
    // state — the browser's own registration fetch shouldn't ever hit a
    // redirect in place of the actual script.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|webmanifest)$).*)",
  ],
};
