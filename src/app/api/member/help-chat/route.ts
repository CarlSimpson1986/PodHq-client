import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { askHelpBot } from "@/lib/help-bot";
import { helpChatSchema } from "@/lib/validation/help-chat";

// Tighter than the default 100/min. Currently free (GROQ_API_KEY), but the
// same limit will apply once this switches to the paid Anthropic key nearer
// launch — set now so that switch doesn't need a rate-limit change too.
const HELP_CHAT_LIMIT_PER_MINUTE = 15;

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/help-chat", HELP_CHAT_LIMIT_PER_MINUTE);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { status: "error", message: "Too many messages. Wait a moment and try again." },
      { status: 429 }
    );
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = helpChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  try {
    const reply = await askHelpBot(parsed.data.message, parsed.data.history);
    return NextResponse.json({ status: "ok", reply });
  } catch (error) {
    console.error("[help-chat] askHelpBot failed", { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { status: "error", message: "Something went wrong. Try again, or ask a staff member." },
      { status: 500 }
    );
  }
}
