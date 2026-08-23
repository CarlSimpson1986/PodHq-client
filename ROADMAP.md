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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-9.md`, covering the pilot
mechanism proof (2026-08-05) through the Nutrition/Leaderboard/Challenges
plan's Stage 7 (2026-08-23) — all split out to keep this file within
Claude Code's ~15,000-character `@`-import limit. All archives are
reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history, or `git log` on this file for the exact
split points. This file picks up from the Coach Dashboard's Stage 10a
(2026-08-23) and is the active, auto-loaded log going forward. If this
file grows too large again, split it the same way into a numbered
`ROADMAP-ARCHIVE-10.md`, leave a pointer note at the top of this file,
and update this paragraph plus `CLAUDE.md`'s session-handoff guidance to
match.

## Hove AI Coach — Coach Dashboard, Stage 10a — 2026-08-23

Carl asked for the Coach section to become "a different window with more
options at the bottom" — Home/Coach-home/Profile/Workout/Nutrition as a
second bottom tab bar. Pushed back with real evidence rather than
building it as asked: nested tab bars are a documented anti-pattern
(Apple HIG, Material Design both warn against them — ambiguous back-
navigation, and here it would put a duplicate "Home" tab in the app
meaning two different things depending which bar you're on). Agreed
instead to keep the single existing 5-tab bottom nav unchanged and make
`/coach` itself a richer dashboard with in-page sections. Full plan for
this plus two follow-on features (weekly check-in, habit tracker) agreed
via Plan Mode, pressure-tested by a Plan agent first (real corrections:
`check_ins.completed_at` must never be nullable — no "pending" row
concept, matching the "row exists = happened" convention already used by
`food_log_entries`; `habit_logs`' RLS join is 2-level not 3-level;
nutrition/habit adherence averages need an explicit zero-data guard
returning `null`, not `0`, or an empty week silently reads as a false
"under target" achievement).

**Stage 10a — pure layout restructure**, zero new tables/queries.
`src/app/coach/page.tsx` reorganized into named sections (Today,
Check-in, Workouts, Nutrition, Habits, Coming soon) over the exact same
data it already fetched (`getActiveMembership`, `getCoachProfile`,
`getNextUpcomingBooking`, `getCoachHomeState`, `getRecentCompletedSessions`)
— a `SectionHeading` helper, no new logic. Check-in and Habits render
honest `ComingSoonCard` placeholders until Stage 10b/11 ship real content
into them, same posture as the pre-existing Tech integrations/Challenges
placeholders.

**Verified live** via the persistent playground member (2 months of
seeded history, `playground@myfitpod.test` — see below): every section
renders correctly post-restructure — Today's Gold-member status card,
Workouts showing the real seeded session history unchanged, Nutrition
link intact, new Habits/Check-in placeholders, Coming soon section
unchanged. A pure refactor should be behaviourally invisible except for
layout, and it was. `npx tsc --noEmit`, `eslint`, `npx vitest run`
(32/32), and `next build` all passed clean.

**New: a persistent dev-only playground member**, not cleaned up after
each session like every other test member in this project's history —
Carl asked to "test it in dev" himself. `playground@myfitpod.test` /
`Playground123!`, Aylesbury Berryfields, active Gold membership (not a
trial, so `hasPremium()` stays true regardless of how far back the
backfilled history goes — a 7-day trial clock wouldn't make sense
against 2 months of data), muscle_gain coach profile. Backfilled via a
one-off script (not a migration — this is member data, not schema): 32
workout sessions over ~2 months (Mon/Tue/Thu/Fri pattern, 3 alternating
splits, RPE-driven progressive overload simulated forward using the same
`adjustForRpe` logic as `generate-workout.ts`) and 208 nutrition log
entries across ~51 of the last 60 days (one skipped day a week, real
per-100g values queried from the live `uk_food_composition` table so the
diary is self-consistent with what search would actually return). Stays
in dev indefinitely for Carl's own exploration — not part of the
verify-then-delete throwaway-member pattern used everywhere else.

Next: Stage 10b (weekly check-in — `check_ins` table, due-state machine,
auto-generated weekly review, honestly-stubbed Q&A) and Stage 11 (habit
tracker), per the approved plan. Stages 8 (leaderboard) and 9
(challenges) remain queued ahead of these in the plan file but were not
what Carl asked for this session — not abandoned, just not next.
