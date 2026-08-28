# Archive 35 — Nav/tile fixes + Health redesign + Hypertrophy A/B/C rotation Stages 1-2 (2026-08-27)

Split out 2026-08-28 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time. The Hypertrophy
A/B/C rotation this describes was confirmed live and click-tested later
the same session this was archived (see `ROADMAP.md`'s "Exercise photos
filled in + 18 more free-weight exercises" entry). Reference-only, not
`@`-included anywhere.

## Nav/tile fixes + Health redesign + Hypertrophy A/B/C rotation (Stages 1-2) — 2026-08-27 (same day, later still)

Several follow-ups after Carl tried the app live, plus a big new
feature — checkpointed here (Carl applying the new migration himself)
before continuing into that feature's Stage 3.

**Quick fixes**: "Find a professional" moved from `/dashboard` to Home
(`/`) — Carl's "main dashboard of the home screen" meant Home, not the
Premium hub, a mix-up from the same nav-naming confusion flagged
earlier today. `/coach/profile`'s corner icon (a person silhouette
linking to the *other* `/profile`) swapped for `MoreMenu`, matching
every other Premium page.

**Training**: `exercise-trend-chart.tsx` converted from an 8-week bar
chart to a connected line — Carl wanted "where they started vs where
they are now," which the existing data already supported, just not as
a line.

**Health redesign**: removed the Nutrition/Training summary sections
(both already have their own tabs, same duplication Dashboard's tile
cleanup addressed) and replaced with real wearable widgets:
`step-gauge.tsx` (a half-moon gauge, current vs a 10,000/day default —
no per-member step target exists, flag if that should be configurable)
and `health-metric-card.tsx` (expandable resting-HR/HRV trend charts),
both backed by `getRecentWearableSnapshots` (already existed, just
never surfaced beyond `WearableConnectionCard`'s flat current-value
grid). **Sleep has no real data at all** — Google Health's API
integration this app uses has no sleep field (confirmed in
`wearable-connection-card.tsx`'s own existing comment) — shown as an
honest "not yet available" note rather than an empty chart.

**Hypertrophy A/B/C workout rotation** — the big one, spanning both
repos, entered Plan mode twice for (once to scope, once after Carl's
own framing changed it: "realistically people won't be training 5 days
a week... probably 3 max, so full body workouts... if they want a
specific chest/leg day or build their own they can"). Full detail,
including the real architecture investigation this was based on, in
podHq's `ROADMAP_HISTORY.md`; summary of this repo's half here.

**Stage 1 — catalog expansion**: `exercise-catalog.ts` had only 11
exercises, with chest/shoulders/core at exactly one option each —
found via Explore-agent research before building anything, and flagged
to Carl (he chose to expand the catalog rather than ship with the
overlap). Added 7 exercises across those three groups plus one more
back option, all within Hove's existing 4 equipment categories. Two
honest gaps: `safetyTip`s are drafts in the existing voice, explicitly
**not** final — this app's own convention is real safety guidance
"written by a person, deliberately never LLM-generated," so these need
Carl's actual review. Photos aren't sourced (no image-fetch capability
this session) — `workout-view.tsx` gained a graceful "no photo yet"
placeholder (`onError` on the exercise `<img>`) instead of shipping a
broken image icon for the new entries.

**Stage 2 — persistent template rotation**: new `generateWorkoutTemplateSet()`
(`generate-workout.ts`) picks 3 full-body templates — legs in all
three (the one group present every time), the other 3 slots rotating
chest/back/shoulders/arms/core across A/B/C so the *set* balances even
though no single template hits all 6 groups. New `workout-templates.ts`
persists/looks these up; `getOrCreateWorkoutSession` (`workout-session.ts`)
now resolves the active block's phase (`blockPhaseIndex`, unchanged),
lazily generates the A/B/C set the first time a session lands in a new
phase (mirroring the idempotent-per-booking pattern `workout_sessions`
already used), and picks the next letter by rotation
(`countSessionsForTemplates(...) % 3`). **Weight and reps are always
recomputed live** via the existing `computeWeightKgForBlock`/
`repsTargetForBlock` — only exercise *selection* is now fixed per
phase, RPE-driven progression is untouched. `completeSession`'s
next-session preview updated to match, so it previews what will
actually generate next rather than a differently-computed guess.
`swapExercise` stays session-only, unchanged, by design.

**Real design correction found mid-implementation**: the plan
originally keyed templates on `training_blocks.id`, but a member's
"current block" is very often the *implicit* default (no real row
exists — same `check_ins`-style "row existence = happened" convention)
— that FK would have failed for the common case. Migration
`0067_workout_templates.sql` keys on `block_type` + `block_started_at`
instead, both always available regardless of whether a real row
exists.

**Stage 3 (split-day / "build your own" workout) not started** — Carl
chose to build this in the same pass rather than defer it, but it's a
genuinely separate chunk (pre-generation choice screen, a
focus-muscle-group generation mode, an exercise-picker UI) — paused
here as a natural checkpoint while Carl applies the new migration.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (105/105,
7 new template-generation cases), and `next build` all clean. Not
visually verified — same login limitation as every UI change this
session. **Not yet live** — migration `0067` needs Carl's own paste
into Supabase's SQL Editor before any of Stage 2's code path actually
runs; nothing in it has touched a real database yet.

