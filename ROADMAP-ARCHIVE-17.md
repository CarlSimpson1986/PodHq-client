# ROADMAP Archive 17 — Fitbit summary + Health Centre (2026-08-24)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-25 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the Fitbit-via-Google-Health-API summary (full
detail already in `ROADMAP-ARCHIVE-16.md`) and the full Health Centre
build (recovery baseline/signal, suggest-and-confirm workout adjustment,
the 6-tab `/coach/health` page, a browser walkthrough that caught the
recovery-adjustment double-apply bug, and migration 0058) — both fully
finished and superseded by the flat-tab member app redesign
(2026-08-25) that remains active in `ROADMAP.md`, which also fixed both
nice-to-haves this archive's own text had flagged as outstanding (the
"day X of 5" calibrating indicator and the "Health markers" heading
rename).

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

**Update, 2026-08-25**: this section and the Google Health thread above
it were both committed and pushed to `main` overnight (`6eed525` through
`7062285`), and Carl applied migration 0058 to the live Supabase DB —
confirmed by querying `workout_sessions.recovery_adjusted_at` directly
against the live project, no error. So the two items below are no
longer outstanding; the remaining nice-to-haves are unchanged: a
"collecting baseline, day X of 5" indicator (currently `insufficient_data`
just shows nothing, which could read as broken rather than warming up),
and renaming the "Health markers" card heading, which duplicates the
page's own "Recovery" section label. Neither built yet.

**Update, 2026-08-25 (later same day)**: both remaining nice-to-haves
were built as part of the flat-tab redesign — see the active
`ROADMAP.md`'s "Member app redesign" entry's Dashboard/Health details for
the "Day X of 5, calibrating" indicator and the "Health markers" →
"Connection" heading rename.
