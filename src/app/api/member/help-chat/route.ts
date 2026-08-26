import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { askHelpBot } from "@/lib/help-bot";
import { helpChatSchema } from "@/lib/validation/help-chat";
import { logUnansweredQuestion } from "@/lib/data/help-chat-questions";
import { getStaffRecipients } from "@/lib/notifications/staff-recipients";
import { notifyFireAndForget } from "@/lib/notifications/core";
import { unansweredChatQuestionEmail, memberCrisisSignalEmail } from "@/lib/notifications/templates";

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
    const { reply, needsStaff, isCrisis } = await askHelpBot(parsed.data.message, parsed.data.history);

    // Checked first, and separately from needsStaff below — a crisis
    // signal gets its own urgent, distinctly-worded staff alert, not the
    // generic "couldn't answer this FAQ question" email/queue. See
    // src/lib/crisis-response.ts.
    if (isCrisis) {
      const staffEmails = await getStaffRecipients(member.gym);
      const { subject, html } = memberCrisisSignalEmail({ memberName: member.name, gym: member.gym, message: parsed.data.message });
      for (const to of staffEmails) {
        await notifyFireAndForget({ eventType: "member_crisis_signal", to, subject, html, gym: member.gym, memberId: member.id });
      }
    }

    if (needsStaff) {
      // Awaited, not fire-and-forget — the response only needs to wait on
      // this, not on it succeeding (logUnansweredQuestion/
      // notifyFireAndForget both swallow their own failures), same
      // reasoning notifyFireAndForget's own docstring gives for why every
      // caller awaits it before returning.
      await logUnansweredQuestion({ memberId: member.id, gym: member.gym, question: parsed.data.message });
      const staffEmails = await getStaffRecipients(member.gym);
      const { subject, html } = unansweredChatQuestionEmail({ memberName: member.name, gym: member.gym, question: parsed.data.message });
      for (const to of staffEmails) {
        await notifyFireAndForget({ eventType: "unanswered_chat_question", to, subject, html, gym: member.gym, memberId: member.id });
      }
    }

    return NextResponse.json({ status: "ok", reply });
  } catch (error) {
    console.error("[help-chat] askHelpBot failed", { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { status: "error", message: "Something went wrong. Try again, or ask a staff member." },
      { status: 500 }
    );
  }
}
