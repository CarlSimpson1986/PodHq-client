import "server-only";
import type { GeneratedExercise } from "@/lib/coach/generate-workout";
import type { WeeklyReview } from "@/lib/coach/weekly-review";

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

// Longer-form than NARRATION_SYSTEM_PROMPT's "1-2 short sentences" — this
// is the one narration the member reads deliberately (the weekly
// check-in), not a passing intro line, so it earns a genuine paragraph.
// Still the same non-hedging voice and the same "narrate numbers already
// computed by plain code, never invent or recompute them" boundary as
// every other coach-bot function.
const WEEKLY_REVIEW_SYSTEM_PROMPT =
  "You are the AI Coach for My Fit Pod, a UK private-pod gym, writing a member's weekly performance review. Write in a direct, confident, encouraging voice — never hedge, never say \"I'm an AI\" or suggest the member should double-check with someone else. 3-5 short sentences: acknowledge what they did this week using only the figures given, call out one genuine positive, and suggest one honest area to focus on next week. Plain language, no markdown, never invent a number not present in the data.";

// Deliberately does NOT include totalSteps/avgRestingHeartRate/
// avgSleepMinutes in what's sent to the LLM provider, even though
// WeeklyReview carries them — those three are wearable-derived health
// data (ICO explicitly treats fitness-tracker steps/heart-rate/sleep as
// health data under UK GDPR Art 9), and sending them to Groq/Anthropic
// (both US processors) is an international transfer of special category
// data with real compliance requirements that aren't in place yet
// (2026-08-28 legal-review discussion with Carl). The member still sees
// their real figures on-screen — checkin-view.tsx renders them straight
// from the review object, no LLM involved — this only narrows what
// leaves the server for narration. Sessions/volume/nutrition were
// already going to the same providers via narrateSessionIntro/
// narratePostSession before this function existed, so keeping those
// here isn't new exposure; steps/HR/sleep would have been.
export async function narrateWeeklyReview(memberName: string, review: WeeklyReview): Promise<string> {
  const parts = [
    `${review.sessionsCompleted} workout session(s) completed`,
    `${Math.round(review.totalVolumeKg)}kg total weight lifted`,
  ];
  if (review.nutritionDaysLogged > 0) {
    parts.push(`nutrition logged ${review.nutritionDaysLogged}/${review.nutritionDaysInWindow} days`);
    if (review.avgDailyCalories !== null) parts.push(`averaging ${review.avgDailyCalories} kcal/day on days logged`);
  } else {
    parts.push("no nutrition logged this week");
  }
  const userPrompt = `Write ${memberName}'s weekly performance review based on this week's actual figures: ${parts.join(", ")}.`;
  return askProvider(WEEKLY_REVIEW_SYSTEM_PROMPT, userPrompt);
}

// Client-perspective review, 2026-08-30 — narrateWeeklyReview above used
// to run BEFORE the member answered anything (checkin route's GET), so
// "your coach's review" could never actually respond to how the week
// felt, what got in the way, or whether they kept last week's habit up —
// a report, then a form, never a conversation. This replaces it: called
// from /complete, after the member's own answers exist, so the response
// can actually be built from them.
//
// Deliberately does NOT receive hadPain/painDetail — same "don't send
// health data to a US LLM provider" boundary narrateWeeklyReview's own
// comment already draws around wearable sleep/heart-rate data (a real
// UK GDPR Art 9 special-category-data question, not resolved as of the
// 2026-08-28 legal-review discussion this app already had once). A pain
// report is squarely the same category. Pain gets acknowledged instead
// via PAIN_ACKNOWLEDGMENT in the /complete route — fixed, reviewed copy,
// same "nothing with real injury risk gets left to an LLM to improvise"
// principle as this app's exercise safety tips and RPE-adjustment logic.
// weekFeel/barriers/habit are motivational/lifestyle content, the same
// category already sent via narrateSessionIntro/narratePostSession, so
// no new exposure there.
const CHECKIN_RESPONSE_SYSTEM_PROMPT =
  "You are the AI Coach for My Fit Pod, a UK private-pod gym, responding directly to a member's weekly check-in. Write in a direct, confident, encouraging voice — never hedge, never say \"I'm an AI\". 3-5 short sentences: acknowledge how their week actually went using the figures and their own words, respond to anything that got in their way, and reference their habit commitment — praise following through, or reset encouragingly without guilt-tripping if they didn't. Plain language, no markdown, never invent a number or detail not present in the data. Do not mention pain, injury, or physical discomfort — that's handled separately.";

// Mirrors checkin-view.tsx's WEEK_FEEL_OPTIONS labels — kept local since
// this is presentation copy for the LLM prompt, not a shared constant
// either side needs to import.
const WEEK_FEEL_LABELS: Record<number, string> = { 1: "Rough", 2: "Tough", 3: "OK", 4: "Good", 5: "Great" };

export interface CheckInAnswers {
  weekFeel: number;
  barriers?: string;
  habit: string;
  // Both present together or both absent — see completeCheckInSchema's
  // own pairing rule in the /complete route. previousHabit is null when
  // this is the member's first-ever check-in (nothing to follow up on).
  habitFollowUp?: "yes" | "partially" | "no";
  previousHabit?: string | null;
}

export async function narrateCheckInResponse(memberName: string, review: WeeklyReview, answers: CheckInAnswers): Promise<string> {
  const parts = [
    `${review.sessionsCompleted} workout session(s) completed`,
    `${Math.round(review.totalVolumeKg)}kg total weight lifted`,
    `rated the week "${WEEK_FEEL_LABELS[answers.weekFeel] ?? "OK"}"`,
  ];
  if (review.nutritionDaysLogged > 0) {
    parts.push(`nutrition logged ${review.nutritionDaysLogged}/${review.nutritionDaysInWindow} days`);
  } else {
    parts.push("no nutrition logged this week");
  }
  if (answers.barriers) parts.push(`what got in their way this week: ${answers.barriers}`);
  if (answers.previousHabit && answers.habitFollowUp) {
    const followUpLabel = { yes: "kept up with it", partially: "partly kept up with it", no: "didn't keep up with it" }[answers.habitFollowUp];
    parts.push(`last week's habit commitment was "${answers.previousHabit}" — they ${followUpLabel}`);
  }
  parts.push(`this week's new habit commitment: "${answers.habit}"`);

  const userPrompt = `Write a direct response to ${memberName}'s weekly check-in based on: ${parts.join(", ")}.`;
  return askProvider(CHECKIN_RESPONSE_SYSTEM_PROMPT, userPrompt);
}

// Fixed, reviewed copy — never LLM-generated, same principle as this
// app's exercise safety tips (see narrateCheckInResponse's own comment
// above for why). Deliberately doesn't try to weave painDetail's freeform
// text into a natural sentence — that risks mangling a member's own words
// into something that reads oddly, for no real benefit over a plain
// acknowledgment.
export const PAIN_ACKNOWLEDGMENT =
  "Thanks for flagging that — go easy on anything that aggravates it this week, and I'll bear it in mind for your next session.";
