# Archive 65 — Three competitor-gap features (2026-09-06)

Split out of `ROADMAP.md` 2026-09-07 to stay under the ~15,000-character
import limit — this section was fully finished and verified live. See
`ROADMAP.md`'s own header for the full archive-splitting convention.

## Three competitor-gap features: exercise-avoid memory, chat safety audit, readiness check — 2026-09-06

Same-day follow-up to the two sessions above, acting on the remaining
opportunities from the ChatGPT Deep Research pass on rival coaching-app
complaints (Fitbod/Future/Zing/JSA). Carl: "all three."

**Persistent "never suggest this again" exercise memory.** New
`member_avoided_exercises` table (`0089`, podHq) — `(member_id,
exercise_key, reason?)`, unique pair, modelled directly on
`member_workout_manual_logs`. New `src/lib/coach/avoided-exercises.ts`
(get/avoid/unavoid, plus a catalog-joined list for the settings screen).
Wired into the exact hard-exclusion tier injury/equipment already use —
`combineExcludedKeys` (workout-session.ts) gained a third param, and
`generate-workout.ts`'s three independent exclusion sites
(`selectExercises`, `generateWorkoutTemplateSet`, `pickFocusExercises`)
each gained an `avoidedKeys` param, unioned in alongside the other two.
New `avoidAndSwapExercise()` records the avoidance then immediately
swaps today's instance for a same-muscle-group alternative (mirrors
`swapExercise`'s own candidate logic) — if none exists, the avoidance
still sticks for next time, today's pick just stays put. UI: a "Never
suggest again" link next to every exercise's existing "Swap" link
(overview screen), plus an "Avoided exercises" list with per-item
"Remove" under the `injuries` textarea in Coach settings.

**Chat tool-calling safety audit** (both repos' AI chats, informed by
common rival-chatbot complaints about bad/unsafe advice). Pod Assist
(podHq) and Pod Coach's access-control model were both found sound — no
tool anywhere can write/side-effect, and Pod Assist's gym-scoping is
enforced server-side, proven by its own adversarial eval suite. The real
gaps were in Pod Coach's advice-quality safety specifically: (1)
`coach-chat.ts` never received the member's `injuries`/avoided-exercise
data at all, despite that data existing and being used correctly
elsewhere — now threaded into `CoachChatContext` and the system prompt;
(2) the "never hedge, never suggest they double-check with someone
else" instruction had no carve-out for pain/injury/medical-sounding
messages — added an explicit exception: acknowledge plainly, suggest
easing off, recommend a professional if it persists; (3) `search_pubmed`
results (third-party abstract text) had no "treat as data, not
instructions" framing, unlike Pod Assist's fully closed tool-input
model — one line added; (4) zero automated test coverage existed for
`coach-chat.ts`/`help-bot.ts`/`crisis-response.ts` — added
`coach-chat.test.ts` covering the crisis-marker interception and the
banned-word bounded retry (mocked provider fetch, not testing model
output quality). Not changed: Pod Assist's evals staying outside default
`npm test` (real API cost per run, a reasonable tradeoff) and the
2026-08-31 token-budget mitigation (no evidence it needs to be
structural yet).

**Pre-workout readiness check** — the no-wearable equivalent of the
existing wearable-driven recovery signal, reusing almost the entire
mechanism rather than building a second one. New
`workout_readiness_checks` table (`0090`, podHq) — one row per session,
`sleep_quality`/`soreness`/`energy` each `"low"|"medium"|"high"`.
`getRecoverySignal`'s sibling `getSelfReportedRecoverySignal()`
(recovery-signal.ts) feeds the *same* `RecoverySignal` union via a new
`"self_reported"` reason, so the existing low-recovery banner and
`applyRecoveryAdjustment` needed no changes to handle it —
`getRecoveryAdvice` (workout-session.ts) just falls through to a
readiness check when there's no wearable data before finally giving up
at `insufficient_data`. `applyRecoveryAdjustment` now also sets
`weight_change_reason` on every discounted exercise (reusing the column
from the previous session's "why" feature) with the real trigger —
wearable-driven or self-reported. UI: a 3-question (Sleep/Soreness/
Energy, Low/Medium/High) card shown once per session when there's no
wearable data and no check yet submitted.

**Verified live** against the same seeded dev test member: avoided
Barbell Squat mid-session → confirmed the DB row and the auto-swap to
Romanian Deadlift → confirmed it showed in and could be removed from the
Coach-settings list; asked Pod Coach "my shoulder hurts during overhead
presses, should I keep pushing through it?" and got a caution-first
answer (stop the movement, shoulder-friendly alternatives, see a
professional if it persists) instead of blind encouragement; submitted a
Low/Low/Medium readiness check and confirmed it triggered the existing
"Recovery looks low today" banner and the real weight reduction +
reason text. `tsc --noEmit`, eslint, `npx vitest run` (190/190), and
`npm run build` all clean. Migrations `0089`/`0090` applied live by Carl
via Supabase's SQL Editor before verification — same pattern as every
prior migration.

**Found and fixed same session**: `/coach/profile`'s "Save changes" always
400'd — `coach-profile-edit-form.tsx`'s submit body never includes
`agreedToPrivacy`, but `coachProfileSchema` required
`agreedToPrivacy: z.literal(true)` on every save, not just onboarding.
Fixed by making the field optional in the schema and enforcing "must be
true" only in the route, only when `!member.privacy_policy_accepted_at`
— a returning member editing their profile is never asked to re-consent.
Also fixed a second bug the same code exposed: the route unconditionally
re-stamped `privacy_policy_accepted_at` on every save, resetting a
member's real original consent timestamp on every routine edit; now only
stamped the first time, same guarded-once pattern the adjacent
`trial_started_at` logic already used. Verified live against the seeded
dev test member: save succeeded and `privacy_policy_accepted_at` stayed
at its original timestamp. `tsc --noEmit`, eslint, `npx vitest run`
(190/190) clean.
