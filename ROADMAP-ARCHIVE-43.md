# Archive 43 — Squat/Bench/Deadlift split, custom-workout rest timer (Stage 1 of CrossFit-style formats) (2026-08-29)

Split out 2026-08-29 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, finished and
verified live (Squat/Bench/Deadlift split) or build/test-verified
(rest timer). Reference-only, not `@`-included anywhere.

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
