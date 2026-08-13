import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

// The VAPID public key isn't secret by design (it's handed to every
// subscribing browser) — session-gated anyway for consistency with every
// other route in this app, since this is only ever called from the
// already-authenticated /bookings page.
export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ status: "error", message: "Push not configured." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", publicKey });
}
