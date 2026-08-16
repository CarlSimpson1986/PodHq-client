import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Deliberately unauthenticated and unrated-limited — an external uptime
// monitor needs to hit this without a session, on a short interval, from
// an IP that isn't the app's own traffic. Listed in proxy.ts's
// PUBLIC_API_EXACT_PATHS so the auth gate doesn't redirect it to /login.
// Checks real DB connectivity, not just "the Next.js process is up" — a
// page that loads but can't reach Supabase (and therefore can't book,
// unlock, or take a payment) is not actually healthy, and that's the
// failure mode a plain "hit the homepage" monitor would miss.
export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("members").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;

    return NextResponse.json({ status: "ok", checks: { database: "ok" }, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[api/health]", { error: err instanceof Error ? err.message : err });
    return NextResponse.json(
      { status: "error", checks: { database: "error" }, timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
