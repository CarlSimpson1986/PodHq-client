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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-44.md`, covering the pilot
mechanism proof (2026-08-05) through the AMRAP format and Weights/Cardio
split (2026-08-29) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as much
as "what's oldest" (see each archive's own header note for examples).
Reference-only, not auto-loaded by CLAUDE.md; check them for full build
history, or `git log` on this file for exact split points. Active content
here starts at "Stage 3 of custom workouts — Rounds For Time" (2026-08-30).
If this file grows too large again, split it the same way: move the most
clearly finished section into `ROADMAP-ARCHIVE-45.md`, update this
paragraph.

## Stage 3 of custom workouts — Rounds For Time — 2026-08-30

Rounds-For-Time joins AMRAP as the second Cardio sub-format: a member
prescribes a round count and races the clock (a stopwatch counting up) to
finish every round. Reused migration `0072`'s columns exactly as that
migration's own comment anticipated, plus a new `0073_workout_rounds_
for_time.sql` (podHq, shared DB) for `target_rounds`/`elapsed_seconds`.

**Corrected same day** after Carl pushed back ("i dont think thats how
rounds for time works") and a web check against real CrossFit RFT WODs:
the first pass copied AMRAP's reps-or-duration exercise config wholesale
and had no time cap at all — a stopwatch a member could stop after 15
seconds for "4 rounds in 0:15". Real RFT is reps-only per round (a
fixed-duration movement can't be raced) and always carries a time cap.
Fixed: RFT's builder is reps-only (no Duration option), a required time
cap was added, and the stopwatch now auto-transitions to a self-reported
DNF tally (mirroring AMRAP's own tally UI, reusing the same
`partial_round_exercise_index`/`partial_round_reps` columns) if it hits
the cap before "Finished!" is tapped.

Also fixed while reviewing the format alongside this: the Training page's
"Last session" card (`last-session-card.tsx`) previously rendered any
completed AMRAP/RFT session as a wall of "Not rated" badges with no
weight — it had no per-set actuals to show for a circuit format. Now
format-aware: shows a rounds/time result line instead.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (152/152), and
`npm run build` all clean throughout both passes. Live-verified on the
playground member/booking: a normal finish, a real time-cap DNF (ran the
stopwatch past a 1-minute cap, confirmed the auto-transition and the
"2 rounds, then 6 reps of Jumping Jacks in 1:00 (time cap)" summary), and
the Last Session card showing both outcomes correctly.

**Not built this stage**: mid-circuit exercise swap (matches AMRAP).

## Coaching review — three training-engine gaps, check-in pain feedback loop — 2026-08-30

Asked Claude to review the training/coaching engine and the weekly
check-in "as an experienced coach," not just for code correctness — found
real programming-quality and product gaps a lifting-savvy reviewer would
catch that a code-only review wouldn't.

**Training engine (`generate-workout.ts`, `types.ts`, `block-change-gate.ts`):**
- `getInjuryExcludedKeys`'s substring match worked for every
  `avoidIfInjury` keyword except `"shoulders"` — the one keyword stored
  plural. A member typing the natural singular ("shoulder injury") matched
  nothing and got zero exclusions: a real reported injury, silently
  ignored. Fixed generally (strip a trailing "s" before matching) rather
  than special-casing the one keyword.
- `experience_level` (beginner/intermediate/advanced) was collected at
  onboarding and never used anywhere in generation — identical RPE-driven
  progression for everyone. Added `RPE_ADJUSTMENT_PERCENT_BY_EXPERIENCE`
  (types.ts): beginner ±8%, intermediate ±5% (unchanged default), advanced
  ±3% — deliberately the *opposite* of "protect beginners with smaller
  jumps": beginners are furthest from their ceiling and tolerate bigger
  jumps, advanced lifters need smaller ones since they're close to it.
- The deload→strength fatigue gate silently skipped its check on a thin
  recent-RPE sample, defaulting to "shift allowed" — and AMRAP/RFT
  sessions never log per-set RPE (nothing to rate in a circuit), so this
  increasingly matters as members adopt those formats. Now a thin sample
  holds the member in their current block instead ("not enough recent
  difficulty ratings to tell if you're ready for something harder").

**Check-in pain feedback loop (new `pain-caution.ts`):** the weekly
check-in's "any pain or discomfort that lingered beyond a normal
workout?" question was captured (`check_ins.answers`) and never read by
anything again — a real self-reported safety signal going nowhere, not
even visible to gym staff (podHq has no admin view onto `check_ins` at
all). Now the member's latest check-in pain report is checked against
every workout on generation/load (all 7 call sites in
`getOrCreateWorkoutSession`/`changeWorkoutMode`/`generateCircuitSession`/
`swapExercise`/`applyRecoveryAdjustment`), naming which of *today's
actual exercises* touch the reported area via the same `avoidIfInjury`
keyword match generation's own injury filter already uses — no second,
drifting implementation. Advisory only (never auto-excludes, same
posture as the existing recovery-signal banner), and self-expiring (it's
always just the latest check-in, so a clean report clears it with
nothing to manually dismiss).

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (157/157, +9 new
tests across the four fixes), and `npm run build` all clean. Live-verified
the pain-caution loop end to end: reported "shoulder, when pressing
overhead" at check-in, next workout correctly flagged **Barbell Front
Squat** — not an obvious "shoulder exercise," but the front-rack position
genuinely loads the shoulders, and the existing catalog data already knew
that.

**Not built this stage**: `weekFeel` (the 1-5 mood rating) and `barriers`
(free-text "what got in the way") are still captured and unused — same
gap as pain was, lower stakes, not addressed this pass. The habit
question's accountability loop is also still half-built: it surfaces
next week as "the habit you committed to," but nothing ever asks whether
the member actually kept it up.

## Injury-keyword coverage expanded to full body parts — 2026-08-30

Asked to expand the pain-caution/standing-injuries keyword list beyond
its original six (knee, back, shoulders, hip, ankle, wrist). Added
**neck, elbow, hamstring, calf, groin, quad** across 86 of the catalog's
98 exercises, tagged by real movement pattern rather than blanket-applied:
elbow on nearly every press/pull/curl (the most common gym overuse
site), hamstring/quad/calf weighted per exercise (a squat gets all
three; a hip-hinge RDL gets hamstring only — a hinge barely touches the
quads), groin only where a movement genuinely stretches the adductors
(sumo deadlift, reverse/deficit lunges), neck on overhead
presses/shrugs/face-pulls/the kettlebell halo. Surfaced two real gaps in
the existing tagging while at it: `dumbbell_calf_raise` had no injury
tags at all despite being *the* calf exercise, and `lying_leg_curl` (a
hamstring isolation machine) had no hamstring tag.

Caught a repeat of the shoulder singular/plural bug (see the coaching-
review stage above) before it shipped: "calf" pluralises irregularly to
"calves", not "calfs" — the same silent-match-failure class, just for
"my calves hurt" instead of "my shoulder hurts". Fixed generally with an
irregular-plurals map (`IRREGULAR_INJURY_PLURALS`) alongside the
existing trailing-"s" strip, so the next irregular plural (English has a
few more — foot/feet, if that's ever added) is a one-line addition, not
a new bug to rediscover.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (158/158, +1
regression test for calf/calves), and `npm run build` all clean. Purely
additive to `avoidIfInjury` arrays — no existing exercise's tags were
changed or removed, confirmed by every pre-existing test still passing
unmodified.

## Weekly check-in rebuilt as a real conversation — 2026-08-30

Client-perspective companion to the same day's coaching review — asked
Claude to go through the check-in "as a client" rather than a code
reviewer. Closes the two gaps the previous stage's own "Not built this
stage" note had already flagged (habit accountability, and the
review-before-listening ordering), plus the pain-acknowledgment gap
found this same session:

**Reordered.** The "coach's review" used to be generated in the GET
route, before the member had answered a single reflection question — a
report, then a form, never a conversation. Now the reflection questions
render first; the response is generated in `/complete`, after those
answers exist, and is actually built from them (mood, barriers, habit)
via a new `narrateCheckInResponse` (coach-bot.ts), not `narrateWeeklyReview`'s
old stats-only prompt. Live-verified: reporting a hectic work week and a
"partially" kept habit produced a response that named both specifically,
not a generic stats summary.

**Habit accountability, closed.** `getPreviousHabit` (check-ins.ts)
surfaces last week's commitment; the check-in now asks "how did that
go?" (No/Partially/Yes) before setting a new one — the follow-up that
was entirely missing before. The existing habit streak (`computeHabitStreak`,
previously only shown on `/coach`) is now surfaced here too, at the
moment it's actually relevant.

**Pain acknowledgment, held to the same compliance bar as wearables.**
The completed screen now acknowledges a reported pain — but via fixed,
reviewed copy (`PAIN_ACKNOWLEDGMENT`), never sent to the LLM. Not a
shortcut: `narrateWeeklyReview`'s own comment already draws this exact
line around wearable sleep/heart-rate data (a real UK GDPR Art 9
special-category-data question from an earlier legal-review session,
2026-08-28) — a pain report is the same category, so it gets the same
treatment rather than quietly reopening that question in a new spot.
Live-verified the LLM response never mentions reported pain, and
`painAcknowledgment` comes back `null` cleanly on the no-pain path.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (158/158, no
regressions), and `npm run build` all clean. Live-tested both the pain
and no-pain completion paths directly against the API (the UI itself
was already "not due" for the playground member that day, having
completed an earlier check-in — same code path either way, verified via
direct request/response rather than click-through).

**Not built this stage**: `weekFeel`/`barriers` are now at least
acknowledged by the coach's response, but nothing yet adjusts future
programming based on them (e.g. a string of "Rough" weeks doesn't
trigger anything). Habit streak still counts "weeks a habit was set",
not "weeks it was actually kept" — evolving that needs the
`habitFollowUp` data this stage just started collecting to accumulate
first.
