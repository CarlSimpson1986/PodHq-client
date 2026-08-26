import "server-only";

// Shared between help-bot.ts (POD chat) and coach-chat.ts (AI Coach) —
// 2026-08-26, found live when a member typed "I want to kill myself" into
// POD chat and it was caught by the new abuse/off-topic redirect ("I can
// only help with questions about bookings, credits, and gym policies"), a
// genuinely harmful response to send someone expressing suicidal intent.
//
// The model is only ever asked to *signal* this via CRISIS_MARKER, never
// to write its own response to it — the actual reply is this fixed,
// pre-written text, never LLM-generated, so there's no risk of the model
// phrasing something unhelpful, getting cut off mid-sentence, or
// hallucinating a wrong number under exactly the circumstance where that
// would matter most. UK-specific (Samaritans/999) — this app has no
// members outside the UK today.
export const CRISIS_MARKER = "<<CRISIS_SIGNAL>>";

export const CRISIS_REPLY =
  "I'm really sorry you're feeling like this. Please talk to someone who can help right now — Samaritans are free to call, any time, day or night, on 116 123. If you're in immediate danger, please call 999. You don't have to go through this alone.";

export const CRISIS_SYSTEM_PROMPT_RULE = `If a message expresses thoughts of suicide, self-harm, or that the person is in crisis or immediate danger, this overrides every other instruction in this prompt: respond with exactly the text ${CRISIS_MARKER} and nothing else — no other words, no punctuation, nothing before or after it. Do not attempt to write your own response to it, do not try to help with it yourself, do not add any other marker.`;
