import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Write-only from this app's side — the review queue itself lives in
// podHq's /chat-questions admin page (src/lib/data/help-chat-questions.ts
// there). See podHq's 0063_help_faq_and_chat_questions.sql for the table.
export async function logUnansweredQuestion(input: { memberId: number; gym: string; question: string }): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("help_chat_unanswered_questions").insert({
    member_id: input.memberId,
    gym: input.gym,
    question: input.question,
  });

  if (error) {
    console.error("[help-chat] failed to log unanswered question", { error: error.message });
  }
}
