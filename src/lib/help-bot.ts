import "server-only";
import { FAQ_ITEMS } from "@/lib/faq";
import { TERMS_AND_CONDITIONS } from "@/lib/terms-and-conditions";

// Q&A-only help assistant ("POD" chat, graduating the static /faq accordion
// to a real LLM per the 2026-08-22 scoping discussion). Deliberately no
// tool-calling into the member's own bookings/credits — v1 answers from the
// known gym policies below and nothing else. Closed-book: told explicitly
// not to guess at policy it wasn't given, since a wrong answer on
// cancellation/waiver/refund rules has real consequences.
//
// Provider is picked by whichever API key is set, so switching from a free
// provider (testing) to a paid one (launch) is a one-line env change, not a
// rebuild: GROQ_API_KEY first (free tier, no commercial-use restriction —
// see podHq's memory notes on why Groq specifically), falling back to
// ANTHROPIC_API_KEY (Claude Haiku 4.5 — the ~£10-15/mo across all 9 gyms
// already scoped in that same discussion).
const SYSTEM_PROMPT = `You are the help assistant for My Fit Pod, a UK private-pod gym booking app. Members reach you by tapping "?" in the app.

Answer ONLY using the information below (the FAQ and the full Terms & Conditions). If a question isn't covered by them, say you're not sure and suggest asking gym staff directly — never guess at or invent a policy.

IMPORTANT — on cancellations specifically: the Terms & Conditions document's own Cancellation Policy clause (9) is OUTDATED and does not reflect what the app actually does. Always answer cancellation questions using the FAQ's cancellation answer below (3-hour window, credit forfeited), never the Terms & Conditions' printed numbers (4hrs/8hrs/£5 fee) — the FAQ always wins on this specific topic.

Keep answers short: 2-3 sentences, plain language, no markdown formatting.

FAQ (most common questions — these are the current, correct answers):
${FAQ_ITEMS.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n")}

Full Terms & Conditions (for anything not covered by the FAQ above):
${TERMS_AND_CONDITIONS}`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function askHelpBot(message: string, history: ChatMessage[]): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    return askGroq(message, history);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return askClaude(message, history);
  }
  throw new Error("No help-bot provider configured — set GROQ_API_KEY or ANTHROPIC_API_KEY.");
}

async function askGroq(message: string, history: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("Groq returned no reply content.");
  }
  return reply;
}

async function askClaude(message: string, history: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const reply = data.content?.[0]?.text;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("Anthropic returned no reply content.");
  }
  return reply;
}
