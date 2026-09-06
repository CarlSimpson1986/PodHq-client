# PodHQ Client — Pod Booking & Kisi Unlock

Staged build order, same philosophy as `../podHq`'s ROADMAP.md: guide the
user through each stage step by step, ask before proceeding on anything
that could go multiple ways, confirm each stage works before moving to the
next. Don't jump ahead to a later stage unprompted.

Sibling project to `../podHq` (the admin/owner analytics app) — this is the
member-facing PWA: book a pod session, unlock the door via Kisi. Reuses
podHq's Supabase project (same `SUPABASE_URL`/keys) and its dark/gold
Tailwind theme, but is a fully separate Next.js app with its own repo and
deploy. Started as an Aylesbury Berryfields-only pilot (decided
2026-08-06); ended that scope 2026-08-16 with the multi-gym signup
dropdown — see the archive below for the pilot-era stage detail.

**Older history has been split into numbered archive files** —
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-63.md`, covering the pilot
mechanism proof (2026-08-05) through the exercise-catalog video expansion
(2026-09-06) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Workout flow design pass" (2026-09-06).
If this file grows too large again, split it the same way: move the
most clearly finished section into `ROADMAP-ARCHIVE-64.md`, update this
paragraph.

## Workout flow design pass + a real progression bug found — 2026-09-06

Same session, continued: Carl clicked through the newly-filled exercise
library live and drove a full redesign pass on the workout screens,
plus asked for a proper competitor-informed feature. All verified live
against the dev server with a seeded test member (Hove, credits/bookings
granted via one-off scripts, matching this project's established
throwaway-script convention).

**Overview redesigned into three collapsible sections** — Warm-up /
Main workout / Static stretching, replacing the old flat exercise list
plus two separate "Add a warm-up"/"Add a cool-down" checkboxes. Main
workout starts expanded, the other two collapsed with a one-line
summary. The checkboxes were removed entirely in a follow-up round —
both sections are now always part of the flow by default, and a member
opts out live via a "Skip warm-up"/"Skip to stretching" link instead of
pre-deciding on the overview screen. `skipMainWorkout()` added so a
member can also bail out of the main workout early and jump straight to
stretching (previously only reachable by finishing every set).

**"← Exit" replaced with "← Home"** plus `ArrowLeftIcon` (already
defined in `icons.tsx` for exactly this "leave this nav" case, but
unused until now) — Carl: the plain underlined text was easy to miss as
the way back out of the workout flow entirely.

**Core exercises now always sort to the end** of the main workout
(Carl: "core should be the end") — a stable partition applied in both
`generateWorkout()` and `instantiateTemplate()` (the template-based path
is what most sessions actually take, once there's an active block), so
whichever muscle-group rotation ran, any `core`-tagged pick moves after
everything else while keeping its own relative order. Deliberately
left "Build your own" (manual/AMRAP/RFT/HIIT picks) untouched — that's
the member's own explicit order, not an AI-generated one.

**Warm-up/cool-down redesigned to step through one item at a time**,
matching the main workout's own flow, instead of showing the full
checklist at once (Carl: "yes" once he understood why it had been a
checklist — no reps/weight to log per item, so a flat list was the
original reasoning, but a step-through reads clearer). `warmupItemIndex`/
`cooldownItemIndex` replace the old shared `checkedIndices` set, reset
to 0 on entering each phase.

**"Why did this change?" explainability shipped**, prompted by a
ChatGPT Deep Research pass on competitor complaints (Fitbod/Future/
Zing/JSA — full findings not reproduced here, ask Carl for the
document) that named "forgotten previous weight/no visible reasoning"
as the single most-repeated failure across the category. Every working
set's weight target now shows a plain-English "Why:" line — held/
increased/reduced against last time's real RPE, or a deload-week note —
computed by a new `describeWeightChangeReason()` that's a pure readout
of the exact rule `adjustForRpe` already runs, never a separately
invented explanation. New `workout_exercises.weight_change_reason`
column (`0088_workout_exercise_weight_reason.sql`, podHq), threaded
through `generateWorkout`, `instantiateTemplate`, and the exercise-swap
flow so it stays correct after a member swaps an exercise mid-session
too.

**Found and fixed a real pre-existing bug while building the above**:
`getWorkoutHistory()` read `weight_target_kg` (the *suggested* number)
instead of `weight_actual_kg` (what the member actually lifted) when
building progression history. A first-time exercise's target is null by
design (see generate-workout.ts's own comment on why), so this silently
zeroed out `lastWeightKg` the very next time that exercise came up —
exactly the "previous weight forgotten" complaint the research named,
caught live via the exercise-swap flow producing "Held the same as
nullkg last time" before the fix. Also skips any completed set with a
null `weight_actual_kg` (a duration-based hold, or an anomaly) rather
than recording a bogus zero, so an older real-weight completion wins
instead of being shadowed.

Also fixed along the way: the workout page's `PageHero` dropped its
"Your AI Coach" subtitle (Carl: not needed) — `subtitle` is now optional
on `PageHero` itself, not just blanked for this one caller.

**Verified live throughout** via a seeded dev-only test member (not a
real customer) — booked/re-booked sessions, swapped an exercise into
one with real prior history to force a non-null "Why:" line, confirmed
the DB write directly after each change rather than trusting the UI
alone. `tsc --noEmit`, eslint, and `npx vitest run` (178/178) clean
after every round; `npm run build` clean at the end. Migration
`0088` applied live by Carl via Supabase's SQL Editor before the
exercise-swap verification pass, same manual-application pattern as
every other migration this project uses.

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
