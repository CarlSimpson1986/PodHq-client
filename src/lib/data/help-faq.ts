import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// FAQ for the POD help chat (src/lib/help-bot.ts) — moved off the old
// static src/lib/faq.ts array 2026-08-26 so staff can edit it from
// podHq's /chat-questions admin page without a code deploy. Same
// database, read via the service-role client per this app's own
// convention (no client-side Supabase queries). See podHq's
// 0063_help_faq_and_chat_questions.sql for the table.
export interface FaqItem {
  question: string;
  answer: string;
}

export async function getFaqItems(): Promise<FaqItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("help_faq_items")
    .select("question, answer")
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
