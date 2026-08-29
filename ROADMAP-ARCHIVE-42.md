# Archive 42 — Today's Mission on Home, workout mode-swap redesign, always-visible workout preview, 50-min exercise-count budget (2026-08-29)

Split out 2026-08-29 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, finished and
verified live. Reference-only, not `@`-included anywhere.

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
