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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-10.md`, covering the pilot
mechanism proof (2026-08-05) through the Coach Dashboard's Stage 10a
(2026-08-23) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. All archives are reference-only (not
auto-loaded by CLAUDE.md); check them for full stage-by-stage build
history, or `git log` on this file for the exact split points. This file
picks up from the weekly check-in's Stage 10b (2026-08-23) and is the
active, auto-loaded log going forward. If this file grows too large
again, split it the same way into a numbered `ROADMAP-ARCHIVE-11.md`,
leave a pointer note at the top of this file, and update this paragraph
plus `CLAUDE.md`'s session-handoff guidance to match.

## Hove AI Coach — Weekly Check-in, Stage 10b — 2026-08-23

Fixed weekly cadence — every Sunday, revised from an original rolling-
weekly draft after Carl's call: "Sunday, so they can get motivated for
Monday", a real coaching pattern (review the week just gone right before
the work week starts). `CHECK_IN_DAY_OF_WEEK`/`CHECK_IN_GRACE_DAYS` in
`types.ts`. New `podHq/supabase/migrations/0054_check_ins.sql`
(`check_ins`: member_id, period_start/end, completed_at, `answers jsonb`
— deliberately schemaless since the real question set isn't decided yet,
same "row exists = happened" convention as `food_log_entries`, no
"pending" row ever inserted).

**Built**: `src/lib/coach/checkin-state.ts` — pure discriminated-union
state (`no_profile`/`not_due`/`due`/`overdue`) mirroring `trial-state.ts`'s
shape exactly, with a real edge case handled deliberately: a member's
first due-Sunday can fall before their `coach_profiles.created_at` (e.g.
profile set up on a Wednesday) — correctly treated as "not due yet"
rather than "overdue for a week that predates them," the accepted
partial-first-week quirk of any calendar-anchored cadence.
`src/lib/coach/weekly-review.ts` — the auto-generated "let's view your
week" summary, following `getRecentCompletedSessions`'s exact batching
shape but date-windowed; two real date-handling seams got the same
`london-time.ts` treatment as everywhere else in this app (`timestamptz`
`workout_sessions.created_at` needs `londonWallTimeToUtc` bounds, the
already-London-pinned `food_log_entries.logged_date` needs none); the
nutrition average divides by days actually logged (not days in the
window) and returns `null` (not `0`) when nothing was logged, so an
empty week renders as an honest "No meals logged this week" instead of a
false "way under target" reading. `/coach/checkin` (`CheckInView`)
shows the due-state, the computed weekly numbers, and an honest
"Reflection questions coming soon" stub — never fabricated placeholder
questions — plus a "Mark check-in complete" action once due/overdue.
Dashboard's Check-in card now shows real countdown/due/overdue state
instead of a static "coming soon" placeholder.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (40/40 —
8 new tests for `checkin-state.ts` covering all four states, the exact
grace-window boundary day, the first-week-before-profile-creation edge
case, and a check-in from a *previous* period correctly not covering the
current one), and `next build` all passed clean, including the two new
`/api/member/checkin*` routes and `/coach/checkin` page. **Live
verification still pending** — needs Carl to run
`0054_check_ins.sql` first, same as every other migration in this
project's history.

Same-day, mid-build: Carl asked for two more Coach-section changes —
renaming the Workout tab to "Training" and replacing its flat
chronological history list with a week-by-week performance graph per
exercise. Picked up immediately after this stage; see the next entry.

## Hove AI Coach — Training Tab Rework — 2026-08-23

`/coach/workout` renamed to `/coach/training` (route, nav label, and page
title all moved together — pre-launch, no external links to break). The
flat chronological "History" list is gone, replaced with a real
week-by-week peak-weight graph per exercise: `src/lib/coach/exercise-performance.ts`
(new — 8-week window, follows `getRecentCompletedSessions`'s exact
three-query batching shape, buckets by London-midnight-normalized day
counts so a late-Sunday-night session lands in a consistent week bucket
regardless of time-of-day/DST, same convention as `checkin-state.ts`'s
`daysBetweenMidnights`) and `ExerciseTrendChart`
(`src/components/exercise-trend-chart.tsx` — a small hand-rolled SVG bar
chart, no charting-library dependency added for an 8-bar sparkline,
matching how this app avoids extra packages where plain markup does the
job). The metric is peak weight lifted per exercise per week — the same
signal `generate-workout.ts`'s RPE-driven adjustments are already
optimising session to session, just made visible instead of hidden.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (40/40),
`next build` all clean (the deleted `/coach/workout` route's stale
generated Next types needed a `.next` cache clear + dev-server restart
to actually disappear from `tsc`'s output — a real gotcha, not a false
alarm, worth remembering for any future route rename). Live-verified via
the playground member's real 2 months of seeded data: Training tab shows
correct climbing bar charts per exercise (Barbell Bench Press → 42.5kg,
Barbell Squat → 40kg, matching the RPE-driven progression the seed script
itself simulated), nav bar correctly relabelled "Training" and
highlighted active.

Carl also raised program periodization mid-build — rotating exercise
selection/rep ranges every ~12 weeks to avoid plateaus and keep
engagement, with a countdown to the change and a suggested "shift or
keep" rather than an automatic switch — plus a direct, important
question: is it actually responsible for an algorithm to autonomously
escalate training difficulty with no human in the loop? Real design
question, not yet built — needs its own focused pass given it touches
`generate-workout.ts` itself (the most safety-sensitive part of this
app) rather than being a UI change like the two above.

**Immediate follow-up, same session — layout refinement**: eleven
stacked exercise charts open by default read as noisy (Carl's call).
`ExerciseProgressAccordion` (`src/components/exercise-progress-accordion.tsx`)
collapses them behind a plain disclosure toggle, closed by default. Two
new sections added: **Current training block** — an honest
`ComingSoonCard` placeholder, not faked content, since there's no "block"
concept in the data model until the periodization work above actually
gets designed and built; and **Consistency** — `src/lib/coach/consistency.ts`
(`getWeeklyConsistency`, same three-query-free single-query + London-
midnight day-bucketing pattern as `exercise-performance.ts`) plus
`ConsistencyChart` (`src/components/consistency-chart.tsx`), a bar chart
of sessions completed per week against the member's own
`coach_profiles.sessions_per_week` goal (dashed target line, bars turn
green when the goal's met that week) — directly reinforces the
accountability/guidance value proposition from the earlier attrition-
research discussion, using data already being collected.

**Also discussed, not built**: whether a single combined line graph
(all exercises, selectable) would beat the per-exercise cards. Pushed
back with a concrete data problem: this member's exercises range from
~8kg (bicep curl) to ~60kg (squat/deadlift) — a shared-axis line graph
would flatten the light exercises to near-invisible next to the heavy
ones. Right fix if a combined comparison view is wanted later:
normalize to **% change from starting weight**, not raw kg, so
dissimilar exercises are actually comparable on one graph. Not built
yet — flagged as the correct approach for whenever it's prioritised.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (40/40),
`next build` all clean. Live-verified via the playground member (same
dev-server-restart-after-new-client-component gotcha hit a third time
this session, same fix): consistency chart shows all-green bars matching
the seeded 4-sessions/week data hitting its own 4/week goal every week;
accordion toggle confirmed expanding/collapsing correctly (+ / − state,
charts appearing on demand).
