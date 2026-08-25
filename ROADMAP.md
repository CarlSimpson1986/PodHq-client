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

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run`, `next build`
all clean throughout. **Update, same day, later**: committed/pushed;
migrations 0059-0061 applied to the live DB (Carl); a real authenticated
browser walkthrough happened after all — see the redesign-follow-up
section below for the whole rest of the day's work, including a stale
session cookie bug this walkthrough surfaced and fixed.

## Redesign follow-up: fixes, Coach restructure, leaderboard, nudges — 2026-08-25 (same day, rest of it)

**Real bug, found live**: after the redesign shipped, Carl's browser had
a stale Supabase session (valid cookie, no matching `members` row) and
got stuck on `NoMemberProfile` with no way out except "Sign up" — which
silently no-ops for an already-registered email. Fixed by giving that
screen a real "Log out and try again" button (same logout sequence
`profile-view.tsx` already uses).

**Meal suggestions, three real bugs found by actually using it**: (1)
the original nearest-fit search over `uk_food_composition` (a raw-
ingredient table) suggested "Oil, vegetable" and "Butter, salted" as
meals — replaced entirely with a hand-written `meal-catalog.ts` (24 real
composed meals, real measurements + cooking steps, never LLM-generated,
same principle as the exercise catalog's safety tips); (2) suggestions
could still exceed the member's remaining calorie budget (a dropped
guard from the rewrite) — now hard-filtered, with no suggestion at all
once there's too little budget left; (3) the "pick 2 suggestions" top-up
had no slot awareness and could suggest two dinners — now prefers an
unused meal slot first. Food search results also got a Cooked/Raw pill
next to the kcal figure, after Carl found "100g of cooked porridge =
84kcal" confusing next to "100g of dry oats = 381kcal" (both correct —
cooking doesn't destroy calories, it just adds a lot of water weight).

**Dashboard → Coach restructure**: Health stopped being a primary tab
("seemed a bit pointless" once Coach existed) — replaced by a merged
Coach tab (check-in + a new weekly habit recommendation +
`weekly-recommendation.ts`, pure discriminated-union logic over real
signals, same pattern as `recovery-signal.ts` + chat). The wearable/
recovery integration moved to a new `MoreMenu` overflow (hamburger,
top-right) alongside Profile and a link back to the main app's booking
Home — `PageHero` gained an optional `rightSlot` prop for this without
touching any other page's icon+iconHref usage. Health's own premium gate
was removed the same thread ("open it up") — the wearable connect/
callback/refresh/disconnect routes never actually checked premium
status, only that page's own redirect did.

**Training rep-range phasing**: hypertrophy/strength blocks now run
three 4-week phases (hypertrophy ~6-8→~10-12→~15-20 reps; strength
6→4→3, deliberately floored at 3 — unstaffed pods, no spotter, true
1-3-rep max-effort work is a real unsupervised-injury risk) instead of
one flat rep target for all 12 weeks. Deliberately not copying
Schoenfeld/Oreb's 3-week-push-then-deload cadence — that's built for
5-6x/week near-max athletes; this member base trains 2-3x/week, so the
real value of phasing is stimulus variety for adherence, not fatigue
management. Surfaced on the Training block card ("Phase 2 of 3 · ~10-12
reps"), not just a silent backend change.

**Multi-site leaderboard** (Gap 3 from a pasted competitive/gap-analysis
doc): one shared board across every gym, open to every member regardless
of premium status, opt-in only (`members.leaderboard_opt_in`, off by
default, shown as first name + last initial even then). Real finding
while building it: `bookings.status` never actually transitions to
`'completed'` anywhere in either codebase — every booking that isn't
cancelled just sits at `'booked'` forever — so it's built on
`pod_access_events.success` instead (a real Kisi unlock, genuinely
cheat-proof). Three boards: sessions this month, current streak
(consecutive weeks hitting **your own** `sessions_per_week` target, not
an absolute count — a 2x/week and a 4x/week member can both have a
"perfect" streak), steps this week (universal since Health opened up).
Real bug found immediately after shipping: the steps board summed 8
days instead of 7 (`londonMidnight().toISOString().slice(0,10)` reads
the wrong calendar date during BST — exactly the class of bug
`london-time.ts` warns about; fixed with `londonDateString`). Reached
from a card on the main Home page (`/`), not just `/dashboard` —
`/dashboard`'s card was invisible to PAYG members, who only ever see
that page's trial banner.

**Demo data, seeded then removed**: `scripts/seed-demo-data-member-123.sql`
added realistic workout/nutrition/wearable history to Carl's own test
account so the redesigned tabs weren't empty; `scripts/remove-demo-data-member-123.sql`
removed it again once real data started mixing with it on the
leaderboard (deliberately excluding two rows: today's wearable sync and
today's food log, both genuinely real by the time cleanup ran).

**Training nudge** (Gap 2): new `/api/notifications/training-nudge`
cron, same shape as the existing `win-back` cron but personalised —
nudges once a member's gone 2x their own normal gap between sessions
(`7 / sessions_per_week`, floored at 4 days, capped at win-back's 21)
without a real attendance event, not a flat day count for everyone.
Confirmed before building: this needed no iOS/App Store dependency at
all (it's email, same as win-back) — that constraint only applies to
push notifications specifically, a separate already-built system with a
real iOS 16.4+ home-screen-install limitation.

**Deferred, deliberately**: Gap 6 (loyalty/rewards — points redeemable
for free credits, à la The Gym Pod Singapore's Activity Points, earned
faster at higher membership tiers) discussed in depth but not built —
Carl's call to prove the leaderboard's attendance data is trustworthy
over a few real weeks before tying free credits to it, and to not bundle
a new financial-liability feature into the same window as the Coach
redesign and the Hove launch. Gap 5 (tier-based feature-gating — Gold
unlocks full AI Coach personalisation, Platinum unlocks nutrition —
distinct from just renaming tiers, which is pure config today) raised
but not started.

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
