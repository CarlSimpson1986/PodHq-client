import "server-only";
import type { GeneratedExercise } from "@/lib/coach/generate-workout";

// AI Coach narration — turns the deterministic plan (generate-workout.ts)
// into Coach-voiced copy. Deliberately NOT where the numbers come from:
// per the decision this session, an LLM computing training loads directly
// is a real safety/reliability risk, so plain code decides sets/reps/
// weights and this only ever narrates a plan it's handed. Same
// provider-swap shape as help-bot.ts (Groq first, Claude Haiku fallback),
// but the prompt is built per-request here rather than once at import
// time, since it depends on the member's own plan.
async function askProvider(systemPrompt: string, userPrompt: string): Promise<string> {
  if (process.env.GROQ_API_KEY) return askGroq(systemPrompt, userPrompt);
  if (process.env.ANTHROPIC_API_KEY) return askClaude(systemPrompt, userPrompt);
  throw new Error("No coach-bot provider configured — set GROQ_API_KEY or ANTHROPIC_API_KEY.");
}

async function askGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // gpt-oss-120b is a reasoning model — it spends completion tokens on
      // a hidden `reasoning` field before the actual reply, so a tight
      // max_tokens (found truncating replies mid-sentence during Stage 3
      // verification, 2026-08-23) silently cuts off content, not just
      // reasoning. reasoning_effort: "low" keeps that overhead small for
      // a task this simple (1-2 sentence narration, no real reasoning
      // needed); max_tokens still has headroom above that as a backstop.
      reasoning_effort: "low",
      max_tokens: 300,
      temperature: 0.4,
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
  return reply.trim();
}

async function askClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
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
  return reply.trim();
}

const NARRATION_SYSTEM_PROMPT =
  "You are the AI Coach for My Fit Pod, a UK private-pod gym. Write in a direct, confident, encouraging voice — never hedge, never say \"I'm an AI\" or suggest the member should double-check with someone else. 1-2 short sentences, plain language, no markdown.";

export async function narrateSessionIntro(memberName: string, exercises: GeneratedExercise[]): Promise<string> {
  // weightTargetKg is null the first time a member does an exercise (see
  // generate-workout.ts's GeneratedExercise) — described as "starting
  // weight to be logged" rather than interpolating a literal "nullkg"
  // into the model's input.
  const plan = exercises
    .map((e) => `${e.name} (${e.sets}x${e.repsTarget} @ ${e.weightTargetKg !== null ? `${e.weightTargetKg}kg` : "starting weight to be logged"})`)
    .join(", ");
  const userPrompt = `Write a short, motivating one-line intro for ${memberName}'s workout today: ${plan}`;
  return askProvider(NARRATION_SYSTEM_PROMPT, userPrompt);
}

export interface WeightChange {
  name: string;
  oldWeightKg: number;
  newWeightKg: number;
  lastRpe: number | null;
}

export async function narratePostSession(memberName: string, changes: WeightChange[]): Promise<string> {
  const summary = changes
    .map((c) => `${c.name}: ${c.oldWeightKg}kg → ${c.newWeightKg}kg (last rated ${c.lastRpe ?? "not rated"}/5)`)
    .join(", ");
  const userPrompt = `Write a short next-session preview for ${memberName} explaining why their weights are changing, based on: ${summary}`;
  return askProvider(NARRATION_SYSTEM_PROMPT, userPrompt);
}
