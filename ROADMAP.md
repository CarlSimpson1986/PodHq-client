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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-16.md`, covering the pilot
mechanism proof (2026-08-05) through the full Fitbit-via-Google-Health-
API thread (2026-08-24) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, and `-16.md`'s own header notes for three same-day examples
of this). All archives are reference-only (not auto-loaded by
CLAUDE.md); check them for full stage-by-stage build history, or
`git log` on this file for the exact split points. This file's active
content is the Health Centre (2026-08-24, unified recovery/nutrition/
training) plus whatever's added after it. If this file grows too large
again, split it the same way: move whichever section is most clearly
finished (not necessarily the chronologically oldest) into a numbered
`ROADMAP-ARCHIVE-17.md`, leave a pointer note at the top of this file,
and update this paragraph.

## Fitbit via Google Health API — 2026-08-24

Full detail moved to `ROADMAP-ARCHIVE-16.md` the same day, once fully
finished and acted upon. Summary: scaffolded the connect/disconnect flow
and daily sync cron against the Google Health API (Fitbit's legacy API
dies September 2026); Carl completed the Google Cloud OAuth setup and
connected a real account; a `CRON_SECRET` fragment got pasted while
testing the sync route manually, so it was rotated as a precaution; and
a member-facing Refresh button was added so a first connection doesn't
have to wait up to 24h for the nightly cron. This directly fed into the
Health Centre work below.

## Health Centre — 2026-08-24 (same day, stage two)

Planned via Plan Mode, then built the same session. Three confirmed
decisions up front: (1) low recovery only ever **suggests** a lighter
session, member must confirm — same trust tier as
`block-change-gate.ts`'s block-transition recommendations, never the
always-automatic tier RPE/deload weight math uses; (2) a new **6th Coach
tab** (`/coach/health`), not folded into the Dashboard; (3) nutrition
stays **display-only** in the Health Centre — only recovery actually
feeds workout generation.

**Recovery baseline + signal**: `member_wearable_data` already stores
one row/day, so a trailing baseline needed no schema change — new
`getRecentWearableSnapshots` (`src/lib/data/wearables.ts`) plus a pure
`getRecoverySignal` (new `src/lib/coach/recovery-signal.ts`, mirrors
`block-change-gate.ts`'s exact discriminated-union shape) comparing
today's synced snapshot against a 14-day trailing average. Two new
invented-but-documented thresholds in `types.ts`
(`RECOVERY_RESTING_HR_DELTA` = +5bpm, `RECOVERY_SLEEP_MINUTES_DELTA` =
-60min), gated by `RECOVERY_MIN_BASELINE_DAYS` = 5 below which it
returns `insufficient_data` rather than guessing — same category as
`CHECK_IN_GRACE_DAYS`/the block thresholds, Carl can retune the numbers.
6 new unit tests in `recovery-signal.test.ts`.

**Suggest-and-confirm adjustment**: `WorkoutSessionDetail` gained a
`recoveryAdvice` field, computed alongside `excludedExerciseKeys` in
`workout-session.ts` (fails open to `insufficient_data` on any error,
same posture as `resolveActiveBlock`). New `applyRecoveryAdjustment`
mirrors `swapExercise`'s exact ownership + `hasProgress` guard — never
allowed once a set is logged — and applies `DELOAD_WEIGHT_MULTIPLIER` to
every `workout_sets` row for that session (weight-only, deliberately not
a set-count reduction too, to keep it a single non-destructive UPDATE;
flagged for Carl to revisit if he wants more than a weight discount).
New route `/api/member/workout/[sessionId]/apply-recovery-adjustment`,
copied from `swap-exercise/route.ts`'s shape. `workout-view.tsx`'s
overview phase shows a dismissible banner ("Recovery looks low today...")
with Reduce/Keep-as-planned buttons when `recoveryAdvice.kind ===
"low_recovery"` and the session hasn't started.

**Health Centre tab**: new `HeartPulseIcon` (`icons.tsx`), added to
`CoachBottomNav` between Training and Nutrition. New
`src/app/coach/health/page.tsx` — Recovery section (the
`WearableConnectionCard` connect/refresh/disconnect flow **moved here
from Profile**, which now only holds fitness/nutrition onboarding
fields), Nutrition section (reuses `getWeeklyReview`'s existing fields,
display-only, links through to `/coach/nutrition`), Training section
(reuses the existing `TrainingBlockView` component as-is, links through
to `/coach/training`). The wearable connect/callback/disconnect routes'
redirect targets were updated from `/coach/profile` to `/coach/health`
to match.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (77/77,
including the 6 new recovery-signal tests), `next build` all clean —
`/coach/health` and the new API route both present in the build output.
**Not yet manually tested end-to-end** — same-day testing of the actual
`low_recovery` banner needs either several more days of real synced
data (only one day exists so far, `RECOVERY_MIN_BASELINE_DAYS` = 5) or a
deliberately seeded/lowered-threshold test, neither done yet.

**Browser walkthrough + a real bug found, same day**: Carl asked for an
"objective outlook as if you were a user" — actually drove `/coach/health`
and `/coach/profile` in Chrome rather than just reasoning from code.
Confirmed the six-tab nav and all three sections render correctly (a
hydration-mismatch console error along the way turned out to be a
dev-mode Fast Refresh artifact, not a real bug — confirmed clean against
an actual `next build && next start`, which is what Vercel runs).

Tracing the flow as a member surfaced a genuine correctness bug:
`recoveryAdvice` was recomputed fresh from live wearable data on every
`getOrCreateWorkoutSession` call, with nothing recording that a member
had already accepted the adjustment — exiting and reopening an unstarted
session re-showed the "reduce today's session" banner, and confirming it
again re-multiplied the already-discounted `weight_target_kg` by
`DELOAD_WEIGHT_MULTIPLIER` a second time (0.85 × 0.85 = 72.5% of
original, not 85%). Fixed by adding a `recovery_adjusted_at` column to
`workout_sessions` (new migration
`0058_workout_sessions_recovery_adjustment.sql` in podHq's migrations
folder — **not yet applied to the live database, on Carl**) —
`applyRecoveryAdjustment` now rejects a second application outright
(`recovery_already_applied`), and `getRecoveryAdvice` short-circuits to
`normal` for any session that already has the flag set, so the banner
never reappears once acted on.

Re-verified after the fix: `tsc --noEmit`, `eslint`, `vitest run`
(77/77), `next build` all clean.

**Still outstanding before this can be considered done**: apply
migration 0058 to Supabase (nothing above works correctly without it —
the column doesn't exist in the live DB yet, so `applyRecoveryAdjustment`
will error until it's run); a "collecting baseline, day X of 5" indicator
was flagged as a nice-to-have (currently `insufficient_data` just shows
nothing, which could read as broken rather than warming up) but not
built; the "Health markers" card heading duplicating the page's own
"Recovery" section label was flagged but not renamed. None of this is
committed or pushed to `main` yet either — still local only.

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
