import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CoachChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export async function getCoachConversation(memberId: number): Promise<CoachChatMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("coach_conversations").select("messages").eq("member_id", memberId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.messages as CoachChatMessage[] | undefined) ?? [];
}

// Capped at the last 40 messages (20 exchanges) — a chat history is a
// convenience for the member to scroll back through, not an archive; this
// keeps the row and the context sent to the LLM bounded without needing a
// separate cleanup job.
const MAX_STORED_MESSAGES = 40;

export async function appendCoachConversationTurn(
  memberId: number,
  userMessage: CoachChatMessage,
  assistantMessage: CoachChatMessage
): Promise<void> {
  const admin = createAdminClient();
  const existing = await getCoachConversation(memberId);
  const messages = [...existing, userMessage, assistantMessage].slice(-MAX_STORED_MESSAGES);

  const { error } = await admin.from("coach_conversations").upsert(
    { member_id: memberId, messages, updated_at: new Date().toISOString() },
    { onConflict: "member_id" }
  );
  if (error) throw new Error(error.message);
}
