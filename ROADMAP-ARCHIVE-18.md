# ROADMAP Archive 18 — Flat 4-tab redesign build (2026-08-25)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-25 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the full initial build of the flat Dashboard/
Training/Nutrition/Health redesign + real Coach chat (data-integrity
corrections, navigation restructure, Training/Health/Nutrition/Coach-chat
detail) — fully shipped, verified, and superseded as the day's active
thread by the same-day follow-up work (Coach restructure, leaderboard,
training nudge) that remains in `ROADMAP.md`, itself later followed by
the nav-context-switch fix and the nav-lag investigation/fix.

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
`hrv_ms` column (migration `0059`, applied same day). The exact response
field name (`dailyHeartRateVariability.rmssdMillis`) is a best-effort
guess from the schema name, not yet confirmed against a live call — logs
the raw shape on mismatch, same "ship it, correct from real Vercel logs"
path steps/RHR both went through 2026-08-24. `WearableConnectionCard`
now shows a 2x2 grid (added HRV) and an honest "Not yet available" for
sleep instead of "—"; its heading was renamed from the duplicate-reading
"Health markers" to "Connection" (an old flagged nice-to-have, fixed
here).

**Nutrition**: calorie-counting mode is unchanged functionally (existing
`NutritionView` diary reused as-is). Hand-portions mode is fully net-new:
`nutrition_tracking_mode` column on `coach_profiles` (migration `0060`,
applied same day), a toggle in Coach settings
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
`0061`, applied same day, one row per member, messages as a jsonb
array). `coach-chat.ts` assembles real context (training block, recovery
status, last session's RPEs, weekly nutrition averages) into a system
prompt and calls the same Groq-first/Claude-Haiku-fallback pattern as
`coach-bot.ts`/`help-bot.ts`. New `/api/member/coach-chat` route, new
`CoachChatView` (quick questions, persisted history via
`coach-conversations.ts`).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run`, `next build`
all clean throughout. **Update, same day, later**: committed/pushed;
migrations 0059-0061 applied to the live DB (Carl); a real authenticated
browser walkthrough happened after all — see `ROADMAP.md`'s "Redesign
follow-up" entry for the whole rest of the day's work, including a stale
session cookie bug this walkthrough surfaced and fixed.
