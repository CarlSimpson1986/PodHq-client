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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-42.md`, covering the pilot
mechanism proof (2026-08-05) through the "Today's Mission on Home"
session (2026-08-29) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see each archive's own header note
for examples). Reference-only, not auto-loaded by CLAUDE.md; check them
for full build history, or `git log` on this file for exact split
points. Active content here starts at "Squat/Bench/Deadlift split..."
(2026-08-29). If this file grows too large again, split it the same
way: move the most clearly finished section into `ROADMAP-ARCHIVE-43.md`,
update this paragraph.

## Squat/Bench/Deadlift split for Strength, custom-workout rest timer (Stage 1 of CrossFit-style formats) — 2026-08-29

**Strength blocks get a real squat/bench/deadlift split**, replacing the
generic muscle-group A/B/C rotation for Strength specifically (Hypertrophy/
Deload untouched) — Carl asked whether this matches how Sebastian Oreb
would actually structure it; researched his real, published coaching
approach rather than guessing (strengthsystem.com, Melbourne Personal
Trainers' Wolf's Den interview, Men's Health AU). Confirmed: our existing
`REP_TARGET_BY_BLOCK_PHASE.strength` ([6, 4, 3] across 3 phases) already
matches his real base→peak descending-rep shape and ~12-week/3-phase
cadence — the one deliberate gap is the floor (he goes to 1-2 reps by the
final phase, we stop at 3, unstaffed-pods-no-spotter reason already
agreed this session). New `STRENGTH_FOCUS_PLAN` in `generate-workout.ts`:
Squat/Bench/Deadlift Day, main lift always first, accessories chosen for
*structural balance* around that lift's actual weak points (his real
philosophy) rather than generic volume — fixed key lists, not muscle-group
filters, so an excluded pick is skipped outright, never swapped for
something unrelated. Carl caught a real gap: the gym's 2-in-1 leg
extension/curl machine wasn't in the list — added `leg_extension`/
`lying_leg_curl` to both Squat Day (quad/hamstring weak-point pairing) and
Deadlift Day (`lying_leg_curl`, direct hamstring contribution). `/training`'s
preview now shows "Squat Day"/"Bench Day"/"Deadlift Day" instead of
"Workout A/B/C" for Strength (`getStrengthFocusLabel`, pure lookup, safe
from a client component). 6 new unit tests (main-lift-first, no duplicate
exercises even though Romanian Deadlift appears on two days, exclusion
skips gracefully rather than substituting, Hypertrophy/Deload unaffected,
label lookup) — live-verified against the playground member (switched
their test block to Strength via a direct `training_blocks` insert,
confirmed all three days render correctly with the right main lift and
accessory order).

**Custom-workout "Your workouts" cards became tap-to-expand** — each
Workout letter is its own collapsible card (the "today's pick" one opens
by default) rather than always showing all three expanded, cleaner for
Strength's now-longer accessory lists too.

**Stage 1 of Carl's CrossFit-style custom-format idea**: eventually wants
AMRAP ("as many rounds as possible in X minutes") and Rounds-For-Time
formats for "build your own" workouts, with reps/duration/weight/rest
configurable per exercise. Scoped in three stages before building anything
(format picker vs. replacing straight sets; what "rest" actually means for
a format that's traditionally continuous) — confirmed: straight sets stays
as a member-pickable format alongside AMRAP/RFT (not built yet, stages 2-3),
and "rest" only ever applies to straight-sets custom workouts (real
CrossFit AMRAP/RFT has no prescribed rest, that's the point of the format).

Stage 1 shipped: **member-set rest-between-sets on custom straight-sets
exercises**, replacing the app's assumed rest values for that one session.
Migration `0071_workout_exercise_rest.sql` (podHq) — nullable
`rest_seconds` on `workout_exercises`, null for every default/focus
exercise and any custom pick left at the builder's default (no behaviour
change there). `WorkoutChoice`'s custom variant gets an optional
`customExerciseRests: Record<string, number>`, threaded through
`generateAndPersistSession`/`changeWorkoutMode`/both API routes/
`loadSessionDetail`. Builder UI: each selected custom exercise gets an
inline "Rest between sets" number input (default 90s, 0-600s range).
Workout-taking UI: a new "resting" phase — countdown from the exercise's
`restSeconds`, "Skip rest →" to advance early, shows which exercise is
next. Needed a `useRef`-backed "latest callback" bridge
(`applyAdvanceRef`) since the rest-timer's `useEffect` has to live in the
component's early, unconditional hooks block (Rules of Hooks — this file
has several early returns before `detail`/`exercise` are known), while the
actual advance logic can only be defined later once those are guaranteed
non-null.

**Real hydration bug caught, not yet fixed** — a genuine SSR/CSR text
mismatch on `/training` ("Workout A" server-rendered vs. "Squat Day"
client-corrected), almost certainly the same stale-cached-JS-after-
dev-restart problem behind this session's repeated hard-reload
workaround, just manifesting as a proper hydration error this time
instead of silently stale content. Self-corrects (React discards and
re-renders client-side) so nothing's broken, but flagged to Carl — likely
what he meant by an earlier "hydration issue on local" comment that got
lost in the conversation before it could be chased down. Suggested Chrome
DevTools' "Disable cache" (Network tab) as a durable fix for his own
testing sessions rather than repeated hard-reloads; root cause (why dev
mode's static chunk URLs don't cache-bust properly across restarts in
this environment) still unresolved.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (148/148),
and `npm run build` (respects the `--webpack` pin) all clean throughout.
Squat/Bench/Deadlift split live-verified end-to-end. Rest-timer UI is
code-reviewed and build/test-verified only — same playground-member
0-credits blocker as the earlier "Change today's workout" feature
prevented a live click-through of the actual workout-taking screen.

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
