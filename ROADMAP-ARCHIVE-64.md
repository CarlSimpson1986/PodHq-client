# Archive 64 — Workout flow design pass + a real progression bug found (2026-09-06)

Split out of `ROADMAP.md` 2026-09-07 to stay under the ~15,000-character
import limit — this section was fully finished and verified live. See
`ROADMAP.md`'s own header for the full archive-splitting convention.

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
