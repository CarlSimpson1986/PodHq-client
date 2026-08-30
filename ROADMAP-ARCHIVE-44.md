# Archive 44 — AMRAP format, Weights/Cardio split (Stage 2 of CrossFit-style formats) (2026-08-29)

Split out 2026-08-30 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, both live-verified.
Reference-only, not `@`-included anywhere.

## Stage 2 of custom workouts — AMRAP format — 2026-08-29

Full AMRAP ("As Many Rounds As Possible in X minutes") build, a genuinely
separate session model from every other mode: no RPE-driven weight/reps
computation at all, since the block/phase engine has nothing to say about
a once-off member-authored circuit.

**Migration `0072_workout_amrap.sql`** (podHq, shared DB) — `format`
('straight_sets' | 'amrap', default 'straight_sets' — every existing row
and every default/focus/straight-sets-custom session from here on reads
exactly that, unchanged), `time_cap_seconds`/`rounds_completed`/
`partial_round_exercise_index`/`partial_round_reps` on `workout_sessions`;
`duration_seconds` on `workout_sets` (a circuit exercise is prescribed as
EITHER reps OR duration, never both — enforced in application code).
`workout_sets.reps_target`'s NOT NULL had to go too — a duration-based set
genuinely has no rep count, same "blank, not a guessed placeholder"
reasoning as `weight_target_kg`'s own NOT NULL drop a few sessions back.

**Generation** (`generateCircuitSession`, `workout-session.ts`) — a fully
separate branch inside `generateAndPersistSession`, not another
`WorkoutChoice` case bolted onto the existing RPE-driven path. One
`workout_exercises` row per movement, exactly one `workout_sets` row each
(set_number 1) holding that movement's round-prescription — no per-set
completion the way straight sets has, since a circuit round repeats
continuously. No coach-profile-missing hard-block the way every other
mode has (no weight/reps computation needs profile data, only injury
filtering) — a missing profile just means no exclusion data, same
graceful degradation `getExcludedExerciseKeysForBooking` already uses. No
intro narration either — `narrateSessionIntro` expects the RPE-engine's
output shape, which a circuit never produces.

**Builder** (`custom-pick`, `workout-view.tsx`) — format picker (Straight
Sets / AMRAP) added ahead of the exercise list; AMRAP mode swaps the
per-exercise rest input for reps-or-duration + optional weight, plus a
time-cap input (1-60 minutes) at the top.

**Taking it** — three new phases. Overview shows the round (exercise
list, reps/duration/weight) and time cap, no warm-up/cool-down toggles
or swap (out of scope for this stage — exercises are fixed once
generated). "amrap-active": full-screen countdown from the time cap, the
round listed for reference while the member cycles through it
themselves, "Finish now" to stop early. Timer hitting zero auto-advances
to "amrap-tally" — unlike Stage 1's rest-timer, this needed no `useRef`
bridge since the target phase never depends on late-computed values, so
a `useRef` holding `() => setPhase("amrap-tally")` (set once, since
`setPhase` itself has a stable identity) was enough to dodge the
`set-state-in-effect` lint rule without the extra indirection layer.
Tally screen: self-reported "how many full rounds, and how far into the
next one" (same trust posture as RPE/weight everywhere else in this
app — no rep-counting sensors), submits to a new dedicated
`completeAmrapSession`/`/api/member/workout/[sessionId]/complete-amrap`
(separate from the existing `/complete` — nothing to derive from logged
sets the way straight-sets volume is, since there are none).

**Not built this stage**: Rounds-For-Time (Stage 3), warm-up/cool-down
for AMRAP, mid-circuit exercise swap.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (148/148),
and `npm run build` all clean throughout. Code-reviewed and build/test-
verified only, not live-clicked — same playground-member 0-credits
blocker as Stage 1's rest timer and the earlier "Change today's workout"
feature; the builder, overview, timer, tally, and summary screens all
need a real booking to reach at all.

**Live-verified end to end same day**, once Carl granted the playground
member real credits (`insert into credits ... 'manual_grant'`) and
booked a real session through `/book` — the actual flow, not a DB
shortcut. Also needed migrations `0071`/`0072` actually pasted into
Supabase (built and committed earlier, but never applied — should have
flagged that explicitly at the time, not left it implicit). Caught and
fixed a real bug this surfaced: the client sent the AMRAP exercise list
as `exercises`, the server schema expected `amrapExercises` — silent
field-name mismatch, `generateWorkoutSchema`'s cross-field refine
correctly rejected it as "Invalid request." but the two names never
matched to begin with. Full click-through afterwards confirmed: choose
screen correctly shows only Focus day/Build your own (no stale "Today's
session" option), format picker, per-exercise Reps/Duration toggle,
live countdown timer (5:00 → 4:54, confirmed ticking), tally screen's
conditional partial-reps field, and a correct final summary ("3 rounds,
then 6 reps of Lat Pulldown"). One testing-tool gotcha worth remembering
for next time, not an app bug: setting a controlled React input's
`.value` directly and dispatching a plain `input` event doesn't reliably
trigger its `onChange` — go through the native `HTMLInputElement`
value-setter descriptor first, same trick used for React Testing
Library's `fireEvent`.

## "Build your own" split into Weights/Cardio, real HIIT/CrossFit content added — 2026-08-29

Carl's reaction to the AMRAP builder once it was live: the single flat
exercise list mixing strength and conditioning movements was confusing
("its fucking all over the place") — asked for an overarching Weights vs.
Cardio choice up front. Rather than reuse AMRAP's reps-vs-duration toggle
as a proxy for the split (arbitrary — plenty of strength accessories are
duration-based too, e.g. planks), added a real `isConditioning: boolean`
field to `CatalogExercise` and tagged every entry against actual
researched HIIT/CrossFit programming, not guessed: the 10 already-present
ballistic/dynamic kettlebell and Russian-twist movements (swings, cleans,
sumo deadlift, core rotation) flipped to `true`; the more controlled
kettlebell entries (goblet squat, bottoms-up press, halo) stayed
strength-tagged as the same slow pattern as their dumbbell/barbell
equivalents. Added 6 new bodyweight conditioning entries — burpee,
mountain climbers, jumping jacks, high knees, jump squats, plank jacks —
real CrossFit/HIIT staples, cross-checked against what the pods actually
have (bodyweight + kettlebells + dumbbells only; no rower, bike, pull-up
bar, plyo box, or wall-ball target, so those movements were deliberately
left out).

`workout-view.tsx`'s format picker relabelled Straight Sets/AMRAP →
**Weights**/**Cardio**, and the exercise list shown in the builder now
filters on `isConditioning` matching the chosen mode (previously showed
every exercise regardless of format) — switching format also clears the
in-progress selection so a half-built Weights pick can't leak into
Cardio. AMRAP's per-exercise default flipped from reps-first to
duration-first (30s) to match how conditioning movements are actually
programmed, in both places that seed it (the config-fallback function and
the exercise-tap handler each had their own hardcoded default — found and
fixed both). Also fixed the muscle-group heading rendering the literal
string "FULL_BODY" instead of "FULL BODY" (`uppercase` class was already
winning the cascade over `capitalize`, and neither handles underscores —
switched to `.replace("_", " ")`).

One existing unit test asserted that `injuries: "back"` alone empties the
"core" exercise pool — broken by the new core-tagged bodyweight additions
(mountain climbers, plank jacks), which are wrist-tagged rather than
back-tagged. This is the third time this session the catalog has outgrown
a test's literal assumption. Fixed by updating the test's injury text to
`"back and wrist"`, verified against a full enumeration of every
core-tagged entry's `avoidIfInjury` list rather than guessed.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (148/148), and
`npm run build` all clean. Live-verified via Turbopack hot-reload on the
same playground booking used for the AMRAP live test: Weights shows the
full strength catalog, Cardio shows only conditioning-tagged exercises
with a duration default already filled in, generating a Cardio session
produced a real AMRAP overview ("8 minutes / 1. Burpee / 30s").

**Not built this stage**: no way back from an in-progress AMRAP/Cardio
session to Weights/straight-sets once generated — only the straight-sets
overview screen has a "Change today's workout" link; also, that link's
gating (`hasSessionStarted`) checks for a `completedAt` on any
`workout_sets` row, which AMRAP sessions never set, so if the link were
added to the AMRAP screens as-is a fully-finished AMRAP session would
still read as "not started." Noted, not fixed — no user-facing report of
this being hit yet.
