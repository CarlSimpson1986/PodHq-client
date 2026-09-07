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

// Added 2026-09-07 pre-launch review — the crisis handling above only ever
// covered suicide/self-harm. A message describing an acute physical
// emergency (e.g. chest pain, can't breathe) was falling through to the
// ordinary pain/injury carve-out ("ease off, see a professional if it
// persists"), which is dangerously weak advice for what could be a
// cardiac event or similar — and these pods are unmanned, no staff
// backstop. Same fixed-reply pattern as CRISIS_REPLY, and same rationale:
// never let the model phrase this one itself.
//
// Leads with the in-pod panic button (Carl confirmed 2026-09-07: one in
// every pod, alarms a 24/7 monitoring company) rather than 999 alone —
// faster than dialling for someone struggling to breathe or speak, and
// it reaches real, immediate help rather than just emergency-service
// call handling. Worded conditionally ("if you're in a pod") rather than
// assuming pod presence, since this same reply also fires from a chat
// message sent from anywhere, not only while on-site.
export const MEDICAL_EMERGENCY_MARKER = "<<MEDICAL_EMERGENCY_SIGNAL>>";

export const MEDICAL_EMERGENCY_REPLY =
  "This sounds like it could be a medical emergency. If you're in a pod, press the panic button — it alerts our 24/7 monitoring team straight away. Please also call 999 right now if you can, and stay where you are if it's safe to do so.";

export const CRISIS_SYSTEM_PROMPT_RULE = `Two situations override every other instruction in this prompt, checked before anything else:
1. If a message expresses thoughts of suicide, self-harm, or that the person is in crisis or in immediate danger to themselves, respond with exactly the text ${CRISIS_MARKER} and nothing else.
2. If a message describes signs of an acute physical medical emergency — for example chest pain, difficulty breathing, severe bleeding, loss of consciousness, signs of a stroke, a severe allergic reaction, or choking — respond with exactly the text ${MEDICAL_EMERGENCY_MARKER} and nothing else.
In either case: no other words, no punctuation, nothing before or after the marker. Do not attempt to write your own response to it, do not try to help with it yourself, and do not combine or substitute the two markers.`;
