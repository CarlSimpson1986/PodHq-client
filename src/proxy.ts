import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/auth/"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Pilot-scope simplification vs. podHq's proxy.ts: no MFA, no lockout, no
// forced-password-change gate, no CSP — a single throwaway test account,
// not real member onboarding. Revisit before this handles real members.
// Named `proxy` (not `middleware`) per Next 16's renamed convention —
// `middleware.ts` still works but is deprecated as of this version.
export async function proxy(request: NextRequest) {
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
            sameSite: "strict",
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

  if (!user) {
    if (isPublic) return supabaseResponse;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/book", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
