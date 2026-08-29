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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-41.md`, covering the pilot
mechanism proof (2026-08-05) through the ~95-exercise video library
session (2026-08-29) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see each archive's own header note
for examples). Reference-only, not auto-loaded by CLAUDE.md; check them
for full build history, or `git log` on this file for exact split
points. Active content here starts at "Today's Mission on Home..."
(2026-08-29). If this file grows too large again, split it the same
way: move the most clearly finished section into `ROADMAP-ARCHIVE-42.md`,
update this paragraph.

## Today's Mission on Home, daily habits, workout mode-swap redesign, always-visible workout preview, 50-min exercise-count budget — 2026-08-29

Picked up the unstarted daily-habit-system idea flagged in the entry
above. Built the daily habit checklist first: `member_habits`/
`habit_logs` (podHq migration `0070`, insert-only tick rows, "row
existence = happened" convention), full CRUD (`daily-habits.ts`,
`/api/member/habits/*`), `DailyHabitsCard` — recommended-list buttons
plus custom checkbox/counted-target entry.

Carl then floated a bigger idea mid-build — a "Today's Mission" card on
Home showing workout/steps/habits/nutrition for premium members,
reversing the documented "Home stays slim, Coach tab is the premium
space" policy in `ai-coach-section.tsx`. Confirmed the reversal
explicitly before building. `getTodaysMission` aggregates all four from
data that already existed (bookings/`workout_sessions` status, latest
wearable snapshot, habit tick counts, today's food log vs. nutrition
target) — no new tables. Shipped as a collapsed-by-default "x/4 today"
card (Carl's call — Home already stacks several cards) that expands to
the four status rows plus the habit checklist inline; habits moved from
`/dashboard` to live here instead, plus a management copy on
`/coach/profile` so a new premium member has somewhere to set habits up
before Home ever shows a populated list.

**Real dev-server bug, not a code bug**: `next dev --webpack` (pinned in
`package.json` since the repo's first commit, never a deliberate fix for
anything) crashed with "Element type is invalid. Received a promise that
resolves to: undefined" on this specific new nested-client-component
pattern (`TodaysMissionCard` rendering `DailyHabitsCard`, now shared
across two routes) — confirmed via a side-by-side Turbopack dev instance
on a different port showing zero errors. Fixed by switching `dev` to
plain `next dev` (Turbopack); `build` stays pinned to `--webpack`, so
production is unaffected either way. Also hit a real stale-HTTP-cache
issue after every dev-server restart — a normal refresh can still serve
an old JS chunk; only a genuine hard reload (Ctrl+Shift+R) reliably
clears it, confirmed repeatedly this session.

**"Change today's workout" replaces the Stage 3 pre-generation choose
screen** (Carl's call): every booking now generates the default A/B/C
plan immediately — no more upfront mode choice. The overview screen
gets a "Change today's workout" link (top of screen, per Carl's
feedback) behind a program-hopping warning, into the existing
focus/build-your-own pickers. New `changeWorkoutMode`/`hasSessionStarted`
in `workout-session.ts`: locked out once any set is logged, otherwise
deletes the unstarted session (no cascade delete on these FKs — manual
child-then-parent delete order) and regenerates in place via a
`generateAndPersistSession` helper extracted from `getOrCreateWorkoutSession`
so both callers share one implementation. New `/api/member/workout/
change-mode` route, same IDOR/validation shape as `/generate`.

**Always-visible workout preview** (`/training`'s new "Your workouts"
section, `getBlockWorkoutPreview`): the A/B/C template store
(`workout_templates`) already lived independent of bookings — this just
exposes it read-only, generating the phase's set eagerly if it doesn't
exist yet, with a "Today's pick" badge on whichever letter a real
booking would actually generate right now (same rotation math
`resolveTemplatedPlan` uses). Confirmed with Carl this stays read-only
(no logging without a real booking) before building the fully
interactive version he first asked for. Each workout is its own
tap-to-expand card; each exercise gets a tap-to-expand technique video
(no thumbnail image — CSP's `img-src` is locked to `'self' data:`, so a
live YouTube thumbnail would need a CSP change; a plain "▶ Watch" toggle
needs none, reusing the same `youtube-nocookie.com` embed the
active-exercise screen already uses). Home's Workout row now links here
instead of `/book` when nothing's scheduled.

**Real "how many exercises fit in 50 minutes" instead of a flat 4**
(Carl's call, worked through together): `computeExerciseCount` in
`generate-workout.ts` — set duration from rep target × ~3s/rep, rest
from Carl's own numbers (hypertrophy: 2min compound / 90s isolation;
strength: 3min / 2min, longer for heavier low-rep work; deload reuses
hypertrophy's numbers), blended 50/50 compound:isolation estimate
against a 50-minute (3000s) budget, floored at the original 4 so this
can only add exercises, never regress below what shipped before.
Replaces the old fixed `TEMPLATE_MUSCLE_GROUP_PLAN` (exactly 4
slots/letter) with an 8-entry priority list per letter (legs leads,
doubles up near the end, keeps the original 3-group-per-letter picks in
the middle) — real range is 5-11 depending on block/phase, clamped to 8
by the hand-authored list length for now. Same change flows through the
default booking path, the template preview, and the goal-based
fallback. Fixed 2 stale hardcoded equipment-allowlist tests that assumed
exactly 4 results (same "catalog outgrew the test's literal list"
pattern as an earlier session) — rewritten to derive the expected set
from the live catalog instead of a hand-typed list, so this class of
test doesn't go stale again on the next catalog or budget change.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (142/142, 2
rewritten), and `npm run build` (respects the `--webpack` pin) all clean
throughout. Live-verified against the playground member (id 134):
Today's Mission expand/tick/add, `/coach/profile` habits section,
`/training`'s workout count 4→8 after clearing that member's stale
phase templates, "Today's pick" badge, and the video toggle. Could not
live-click-test the "Change today's workout" swap itself — the
playground member has 0 booking credits; code-reviewed and
build/test-verified only.

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
