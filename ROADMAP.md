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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-17.md`, covering the pilot
mechanism proof (2026-08-05) through the Fitbit-via-Google-Health-API
summary + full Health Centre build (2026-08-24) — all split out to keep
this file within Claude Code's ~15,000-character `@`-import limit.
Archives aren't always the strictly oldest material — the split point is
"what's finished and stable" as much as "what's oldest" (see
`ROADMAP-ARCHIVE-14.md`'s, `-15.md`'s, `-16.md`'s, and `-17.md`'s own
header notes for four same-day examples of this). All archives are
reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history, or `git log` on this file for the exact
split points. This file's active content is the flat-tab member app
redesign (2026-08-25) plus whatever's added after it. If this file grows
too large again, split it the same way: move whichever section is most
clearly finished (not necessarily the chronologically oldest) into a
numbered `ROADMAP-ARCHIVE-18.md`, leave a pointer note at the top of
this file, and update this paragraph.

## Member app redesign — flat 4-tab IA + real coach chat — 2026-08-25

Carl pasted a Claude-generated design brief + HTML mockup (Dashboard/
Training/Nutrition/Health tabs + an LLM coach chat) and asked for the
whole thing built same-session, reusing the real schema rather than the
brief's invented one. Planned via Plan Mode after a 3-agent parallel
exploration inventoried exactly what was real vs. assumed; built in one
continuous pass afterward. Full plan (data-integrity corrections,
reuse/net-new inventory, build order) archived at
`C:\Users\carls\.claude\plans\delightful-popping-glade.md` if needed —
summary below.

**Data-integrity corrections applied throughout** (the brief assumed
things this session's own research had already disproven or never had):
no vendor "readiness score" exists in the Google Health API (confirmed
against the live discovery document) — Dashboard/Health both use the
existing `getRecoverySignal` plus a new "Day X of 5, calibrating"
indicator instead, never a fabricated 0-100 number; sleep still has no
real data source (`dailyRollUp` has no sleep field), shown as "Not yet
available", not a fake "7h 32m"; RPE copy uses the app's real 1-5 scale
(`RPE_SCALE`) and real `adjustForRpe` ±5% math, not the brief's invented
1-10/+2.5kg language; Coach chat's citations are explicitly softened
("general sports-science practice, not a live citation lookup") since
there's no PubMed API anywhere in this codebase and presenting
LLM-generated citations as verified would be a real trust risk.

**Navigation**: new `member-bottom-nav.tsx` (Dashboard/Training/
Nutrition/Health, replacing the old 6-item `CoachBottomNav`).
`/coach/training`, `/coach/nutrition`, `/coach/health` moved to
top-level `/training`, `/nutrition`, `/health`; new `/dashboard` replaces
`/coach`'s old hub content; `/coach` itself was repurposed in place into
the new Coach Chat screen. `/coach/checkin` and `/coach/profile` stay
where they are. All internal links/redirects (wearable OAuth
connect/callback, main `BottomNav`'s "Coach" tab, `ai-coach-section.tsx`)
repointed to match.

**Training**: new `ExerciseProgressPicker` (dropdown + single chart,
reusing the existing `ExerciseTrendChart`) replaces the all-exercises
accordion; new `getLastCompletedSessionDetail`
(`exercise-performance.ts`) + `LastSessionCard` show real per-set RPE
badges — didn't exist before (`workout_sets.rpe` was a real column
nothing surfaced).

**Health**: new `fetchHeartRateVariability` in `google-health.ts` (goes
straight to the `list` endpoint, same personal-range trap RHR hit) + new
`hrv_ms` column (migration `0059`, **not yet applied to Supabase**). The
exact response field name (`dailyHeartRateVariability.rmssdMillis`) is a
best-effort guess from the schema name, not yet confirmed against a live
call — logs the raw shape on mismatch, same "ship it, correct from real
Vercel logs" path steps/RHR both went through 2026-08-24. `WearableConnectionCard`
now shows a 2x2 grid (added HRV) and an honest "Not yet available" for
sleep instead of "—"; its heading was renamed from the duplicate-reading
"Health markers" to "Connection" (an old flagged nice-to-have, fixed
here).

**Nutrition**: calorie-counting mode is unchanged functionally (existing
`NutritionView` diary reused as-is). Hand-portions mode is fully net-new:
`nutrition_tracking_mode` column on `coach_profiles` (migration `0060`,
**not yet applied**), a toggle in Coach settings
(`coach-profile-edit-form.tsx`), `portions.ts`'s `gramsToPortions`
(25g/palm, 50g/cupped-hand, 15g/thumb — Carl's numbers to retune, 3 unit
tests), and a `PortionsSummary` component replacing the calorie
ring/macro bars when that mode is selected. Meal suggestions are new for
both modes: `meal-suggestions.ts`'s `getMealSuggestions` does a v1
nearest-fit search over the existing `uk_food_composition` table
(~2,900 rows, no specialised index needed per that table's own migration
comment) against the day's remaining macro budget, new
`/api/member/nutrition/suggestions` route, "What to eat next" card with
Add/Regenerate.

**Coach chat**: fully net-new. `coach_conversations` table (migration
`0061`, **not yet applied**, one row per member, messages as a jsonb
array). `coach-chat.ts` assembles real context (training block, recovery
status, last session's RPEs, weekly nutrition averages) into a system
prompt and calls the same Groq-first/Claude-Haiku-fallback pattern as
`coach-bot.ts`/`help-bot.ts`. New `/api/member/coach-chat` route, new
`CoachChatView` (quick questions, persisted history via
`coach-conversations.ts`).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (80/80,
including 3 new `portions.test.ts` cases), `next build` all clean —
every new route (`/dashboard`, `/training`, `/nutrition`, `/health`,
`/coach`, `/api/member/coach-chat`, `/api/member/nutrition/suggestions`)
present in the build output; old `/coach/training`, `/coach/nutrition`,
`/coach/health` confirmed gone. **Not yet done**: a real authenticated
browser walkthrough — this session had no test member credentials and
didn't want to self-serve a live signup against the shared production
Supabase project without asking first. **Three migrations
(`0059_member_wearable_data_hrv.sql`, `0060_coach_profiles_nutrition_tracking_mode.sql`,
`0061_coach_conversations.sql`) still need applying to the live
database** — nothing above involving HRV, hand-portions mode, or Coach
chat will work until Carl runs them, same as migration 0058 needed
applying before the recovery-adjustment feature worked. Not committed or
pushed yet either.

## Equipment-aware AI Coach workout generation — 2026-08-24

Shipped and verified — full detail moved to `ROADMAP-ARCHIVE-14.md` the
same day, to make room for the still-active wearable-integration research
above. Summary: `pod_resources` gained an `equipment` column (empty =
unrestricted, today's exact behavior); `generateWorkout`/`swapExercise`
now filter/re-validate against a resource's configured equipment; podHq's
pod Settings panel gained equipment checkboxes. **Still outstanding**: no
gym's equipment has actually been set yet (including Hove's already-
confirmed real equipment) — every gym runs unrestricted until Carl works
through the Settings panel gym by gym.
