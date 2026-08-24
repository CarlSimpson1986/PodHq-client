# ROADMAP Archive 13 — Workout Session Exit/Resume/Swap, Stage 12 Race Fix (2026-08-23)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-24 once that file exceeded Claude Code's ~15,000-character
`@`-import limit again, to make room for the equipment-aware AI Coach
work. Covers the workout session exit/resume/warm-up/cool-down/exercise-
swap feature and its same-day race-condition fix. The wearable-
integration research note and everything after it continue in the active
`ROADMAP.md`.

## Workout session: exit, resume, warm-up/cool-down, exercise swap — 2026-08-23

Carl flagged there was no way to leave an in-progress workout session
(confirmed — every phase except the summary screen had no way out but
the browser back button), and asked for an opt-in warm-up/cool-down and
the ability to swap an exercise before starting. Scoped via
`AskUserQuestion`: warm-up/cool-down is a toggle on the overview screen
(default off), swap is same-muscle-group only. A Plan-agent review of
the draft design caught a real bug before any code was written:
reopening an exited session always restarted at exercise 1/set 1
(silently overwriting already-logged sets, since `log-set` is an UPDATE
on a pre-existing row) — fixed as part of this same change since the new
Exit button turns that from a rare accidental path into the primary way
back into a session.

**Exit + resume**: a small "← Exit" link (routes to `/`, matching
`CoachBottomNav`'s own convention) on every interactive phase; no
confirm dialog needed since nothing is lost by leaving. `workout-view.tsx`
now derives `hasProgress`/the first not-yet-completed exercise+set from
`detail` on load — the overview screen's button reads "Resume workout"
and seeds `exerciseIndex`/`setIndex` from that point instead of always
`0`/`0`.

**Warm-up/cool-down**: purely client-side, no DB changes — new
`src/lib/coach/warmup-cooldown.ts` with a fixed, hand-written
`WARMUP_ITEMS`/`COOLDOWN_ITEMS` list (generic bodyweight/mobility
content, flagged for Carl to review/replace, same sign-off convention as
`CALORIE_TARGET_FLOOR`). Two new client-only `Phase` values render a
tap-to-check checklist before the first exercise and/or after the last
set. Warm-up is only offered when starting fresh (`!hasProgress`); cool-
down is always offered, including on resume.

**Exercise swap**: `generate-workout.ts`'s inline injury filter was
extracted into an exported `getInjuryExcludedKeys()` (pure refactor, one
new direct unit test — the existing suite already covered it indirectly
through `generateWorkout`) and `computeWeightKgForBlock` was exported,
so the swap's weight recompute reuses the exact same RPE-history/deload
logic real generation uses rather than a second copy. New `swapExercise()`
in `workout-session.ts`, new `POST /api/member/workout/[sessionId]/
swap-exercise` mirroring `log-set`'s exact auth/rate-limit/IDOR pattern.
**Real bug the Plan-agent caught before this was built**: the eligibility
gate can't be `workout_sessions.status !== 'generated'` — status never
leaves `'generated'` until `completeSession()` runs, so that check would
have wrongly allowed a swap mid-session. Gates on whether any set in the
session has `completedAt` set instead — the same signal the client uses
to compute `hasProgress`. Candidates are computed client-side from the
already-bundled `EXERCISE_CATALOG` (confirmed no `server-only` guard on
that file) filtered by a new `excludedExerciseKeys` field on
`WorkoutSessionDetail`; the server independently re-validates muscle
group, injury exclusion, and duplicate-in-session on the actual POST,
never trusting the client's list.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (62/62 —
new `getInjuryExcludedKeys` tests, all previous tests unchanged), `next
build` all clean. Live-verified via the playground member: exit link
present on every phase; logged one set, exited, reopened the booking's
workout link — correctly resumed at "Set 2 of 2" instead of restarting,
button read "Resume workout", swap/warm-up options correctly hidden
once `hasProgress`. Swapped Barbell Squat → Leg Extension on a fresh
session — weight recomputed correctly (17.5kg = the catalog's
intermediate starting weight × the active deload block's 0.85 discount,
not a copy of the old exercise's weight), `sort_order` preserved. Direct
API calls confirmed the server rejects a cross-muscle-group swap, a
duplicate-in-session swap, a nonsense exercise key, and — after logging
one real set — any swap at all, even though nothing in the client would
ever send those. Ran a full session start-to-finish with both toggles
on: warm-up checklist appeared and checkmarks toggled correctly,
cool-down checklist appeared after the last logged set (not before),
"Finish" completed the session normally with real post-session
narration. One pre-existing, unrelated bug surfaced during testing: React Strict
Mode's dev-only double-effect-fire can race two concurrent `POST /api/
member/workout/generate` calls on first load, occasionally hitting
`workout_sessions`' `booking_id` unique constraint and returning a 500.
**Fixed same day** (see below) rather than left outstanding.

### Fix: workout-generate race condition — 2026-08-23 (later same day)

`getOrCreateWorkoutSession` now catches the `23505` unique-constraint
violation on `booking_id` and loads whatever the winning concurrent
request already created, instead of surfacing a 500 — the insert's
existence-check-then-insert window was never actually safe against a
second in-flight request for the same booking, dev-only Strict Mode
double-firing was just the reliable way to trigger it. Also updated the
warm-up/cool-down content per Carl's direct review (Peloton treadmill/
bike for the pulse raiser, fire hydrants for hip mobility) and corrected
`exercise-catalog.ts`'s equipment comment, which only listed the
resistance-training kit. **Verified**: live-reproduced the race (two
concurrent generate requests via the dev server log) and confirmed both
now return 200 with exactly one `workout_sessions` row written.
