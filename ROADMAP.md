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
