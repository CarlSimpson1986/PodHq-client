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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-32.md`, covering the pilot
mechanism proof (2026-08-05) through the bottom-nav/Leaderboard/week-strip
follow-ups (2026-08-27) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s,
`-21.md`'s, `-22.md`'s, `-23.md`'s, `-24.md`'s, `-25.md`'s, `-26.md`'s,
`-27.md`'s, `-28.md`'s, `-29.md`'s, `-30.md`'s, `-31.md`'s, and `-32.md`'s
own header notes for same-day examples of this). All archives are
reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history, or `git log` on this file for the exact
split points. This file's active content is the "uniformity" date-strip
correction (2026-08-27) plus whatever's added after it. If this file
grows too large again, split it the same way: move whichever section is
most clearly finished (not necessarily the chronologically oldest) into
a numbered `ROADMAP-ARCHIVE-33.md`, leave a pointer note at the top of
this file, and update this paragraph.

**Correction, same day, immediately after**: Carl, three screenshots
side by side — Book labelled the right example, Dashboard and Nutrition
both labelled wrong: "i want uniformity." The actual bug in Nutrition:
the new date strip had been nested *inside* `nutrition-view.tsx`'s white
`card-light` card rather than in the dark hero where Book's lives, so it
ended up on the wrong background with inverted colours (black pill on
white instead of white pill on black) — a real placement mistake, not
just a missed styling pass. Fixed by restructuring `NutritionView` to
own its full page body — dark hero (title/subtitle/MoreMenu + the date
strip, using `bg-foreground`/`text-background` like Book) plus the white
card below — the same pattern `booking-grid.tsx` already used, rather
than being nested inside a `PageHero` + wrapper div supplied by
`nutrition/page.tsx`. That page now just renders `<NutritionView />`
directly, same as `book/page.tsx` renders `<BookingGrid />`.

Also rebuilt `week-calendar-strip.tsx` (Dashboard's strip) to use the
exact same pill shape and weekday+day-number content as Book/Nutrition,
not its own earlier single-letter-in-a-circle design — the color fix
from earlier the same day wasn't enough on its own once shape/content
were compared side by side too.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Not visually verified — same login limitation.

## Dashboard tile cleanup + "Find a Professional" directory — 2026-08-27 (same day, later still)

**Dashboard tile cleanup**: Carl — "get rid of ask your coach as it's its
own tab" and "move book your session to training." Both tiles were
genuine duplicates rather than needing new code: Coach chat already has
its own tab in the Premium nav (`MemberBottomNav`), and `/training`
already had its own equivalent "Next session" card. Removed both from
`dashboard/page.tsx`, along with the now-unused `getNextUpcomingBooking`
fetch and import.

## "Find a Professional" — personal trainer directory

Carl wants a PT marketplace modelled on Solo60's "Professional" tab (two
screenshots reviewed): a searchable/filterable directory of trainer
profile cards (photo, specialties, favourite gyms, price/hour), a profile
page, and a "More information" inquiry form (goals/budget/availability,
Send) rather than instant slot booking. Scoped via a short round of
questions before building — see podHq's `ROADMAP_HISTORY.md` (stage 41)
for the full cross-repo write-up, since the data model and admin CRUD
live there; summary of this repo's half here.

**This repo's part**: `src/lib/data/professionals.ts` reads podHq's new
`professionals` table via `createAdminClient()` (same cross-app read
pattern as `catalog.ts`/`catalog_items`). `/professionals` — own
`PageHero` + `BottomNav` (not premium-gated, not `MemberBottomNav`, same
reasoning `/leaderboard` gives for a Dashboard-linked-but-not-coaching
feature) — renders `ProfessionalsDirectory`, a client search/gym-filter
grid. `/professionals/[id]` shows the full profile plus
`ProfessionalInquiryForm` (same local-state/fetch shape as
`redeem-voucher-form.tsx`), posting to a new
`/api/member/professional-inquiries` route that inserts the inquiry then
notifies staff — reusing the exact `unanswered_chat_question` pattern
(`getStaffRecipients` + a new `professional_inquiry` event type +
template, member text through `escapeHtml()`). New `UsersIcon` added to
`icons.tsx` (no two-person icon existed); Dashboard got a matching "Find
a professional" tile next to Leaderboard, same trophy-tile precedent
(icon + centred text).

No photo-upload infrastructure exists anywhere in either app — `photoUrl`
is a plain nullable URL field, falling back to an initials avatar (same
pattern `profile-view.tsx` uses) when empty. Real trainer data and any
upload flow are both explicitly deferred; this ships with placeholder
profiles only, per Carl's own scoping answer.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean in both repos. **Not yet applied live** — migration
`0066_professionals.sql` (podHq) needs Carl to paste the full SQL into
Supabase's SQL Editor himself; nothing in either app's new code has been
exercised against a real database or a real browser session yet.

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
