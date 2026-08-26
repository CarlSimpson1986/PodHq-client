import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getFaqItems } from "@/lib/data/help-faq";
import { checkRateLimit } from "@/lib/rate-limit";

// Backs the quick-question chips in help-chat-view.tsx — the FAQ moved
// from a static import (src/lib/faq.ts) to this DB-backed read
// (src/lib/data/help-faq.ts) 2026-08-26, since help-chat-view is a client
// component and can't call the service-role client directly.
export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/help-faq");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests." }, { status: 429 });
  }

  try {
    const items = await getFaqItems();
    return NextResponse.json({ status: "ok", items });
  } catch (error) {
    console.error("[help-faq] failed to load", { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
