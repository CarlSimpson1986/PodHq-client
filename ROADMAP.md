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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-11.md`, covering the pilot
mechanism proof (2026-08-05) through the Training tab rework
(2026-08-23) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. All archives are reference-only (not
auto-loaded by CLAUDE.md); check them for full stage-by-stage build
history, or `git log` on this file for the exact split points. This file
picks up from training-block periodization's Stage 12 (2026-08-23) and
is the active, auto-loaded log going forward. If this file grows too
large again, split it the same way into a numbered
`ROADMAP-ARCHIVE-12.md`, leave a pointer note at the top of this file,
and update this paragraph plus `CLAUDE.md`'s session-handoff guidance to
match.

## Training-block periodization, Stage 12 — 2026-08-23

Answers the "is it responsible to let an algorithm escalate training
difficulty?" question flagged above: yes, if and only if it never
auto-applies. Standard block periodization (hypertrophy/strength
alternation with a deload between phases) is textbook S&C, not
invented — `hypertrophy(12wk) → deload(1wk) → strength(12wk) →
deload(1wk) → ...`, reusing `REP_TARGET_BY_GOAL`'s existing rep numbers
rather than inventing new ones. Full design agreed via Plan Mode
(`fluffy-sparking-fox.md`'s Stage 12) before building, in three
deliberately separate sub-stages so a member's live numbers never change
without UI explaining why.

**12a (inert)**: `training_blocks` migration (`podHq/supabase/migrations/0055`,
insert-only, "row existence = happened" — an implicit Block 1 covers a
member with zero rows, anchored to `coach_profiles.created_at`);
`training-block-state.ts` (pure `getTrainingBlockState`, mirrors
`checkin-state.ts`); `block-change-gate.ts` (pure
`getBlockChangeRecommendation` — `shift`/`keep`/`extend_deload`, gated
on attendance ratio and, only at the one real escalation point
(deload→strength), recent RPE — deliberately invented-but-defensible
thresholds, same category as `CHECK_IN_GRACE_DAYS`, acceptable only
because they gate a suggestion, never an autonomous change);
`training-blocks.ts` data access. 13 new unit tests. Zero call sites
touched.

**12b**: `generate-workout.ts` gains an optional `activeBlock` param —
absent means byte-identical pre-Stage-12 behavior (all 9 original tests
pass unchanged). A block overrides the rep target/set count
(`REP_TARGET_BY_BLOCK`), deload additionally discounts weight ~15%
(`DELOAD_WEIGHT_MULTIPLIER`) via a new `computeWeightKgForBlock` wrapper
that leaves `computeWeightKg`/`adjustForRpe`/`roundToNearestPlate` — the
actual RPE-driven weight logic — untouched. A Strength block softly
prefers compound lifts via a new `CatalogExercise.isCompound` field (6
compound / 5 isolation), falling back to the full injury-safe set
exactly like the existing muscle-group rotation already does. 6 new
block-aware tests added, including re-running the "never includes an
unsafe exercise" edge case under a strength block. No caller passes
`activeBlock` yet.

**12c**: wired it live. `workout-session.ts` now resolves the member's
active block (`resolveActiveBlock`, wrapped so any error — table
missing, query failure — falls back to `undefined`, i.e. today's
goal-based behavior, never a hardcoded block) and passes it into both
plan-generation call sites. **Fixed a real pre-existing bug while doing
this**: `insertExercisesAndSets` hardcoded `SETS_PER_EXERCISE = 3`
instead of reading each generated exercise's own `sets` field — harmless
until deload could return 2, at which point every deload session would
have silently still gotten 3 set rows, defeating deload's volume cut.
New `block-progress.ts` (attendance + recent-RPE query, explicitly
scoped to `>= currentBlock.startedAt` — a boundary-precision bug class
this app has hit before) and `training-block-recommendation.ts`
(shared by both new routes so GET and POST always derive the same
recommendation from the same live data). New routes: `GET
/api/member/training-block`, `POST /api/member/training-block/confirm`.
Confirm never trusts the client: it re-derives `transition_due`
server-side immediately before writing (no-ops if the member already
progressed — handles double-submit), and independently recomputes the
allowed `chosenBlockType` values, rejecting anything outside them (a
member can always choose to stay in their current block instead of the
suggested shift — agency to not escalate is always safe — but can never
choose to escalate past what the gate allowed). New
`TrainingBlockView` client component replaces the Training tab's
"Current training block" placeholder with a real countdown card (in
block) or a recommendation + confirm screen (transition due).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (60/60 —
6 new block-aware generation tests plus the 54 already there), `next
build` all clean. Migrations `0054_check_ins.sql` and
`0055_training_blocks.sql` were applied to the live dev DB via the
Supabase SQL Editor (confirmed with a direct table check —
`coach_profiles`/`workout_sessions`/`food_log_entries`/
`uk_food_composition` had been present all along, so this was specific
to the two newest migrations, not a wider DB issue).

**Live-verified end to end via the playground member**: backdated a
`training_blocks` row 85 days into the past to force the implicit Block
1 into `transition_due`; `GET /api/member/training-block` correctly
returned `{kind: "shift", nextBlockType: "deload"}` (32 completed
sessions / 48 planned in-block ≥ the 0.6 attendance threshold), and the
Training tab rendered the real countdown-expired card with both
"Shift to Deload" and "Keep training Hypertrophy" options. Confirming
the shift correctly wrote a new `training_blocks` row and the tab
immediately re-rendered `in_block`/deload with a 7-day countdown.
Booked a real session as the playground member and opened its
generated workout: all 4 exercises came back with **2 sets** (not 3 —
confirms the `insertExercisesAndSets` bug fix), **reps target 10**, and
weights discounted from their RPE-adjusted baseline by the deload
multiplier (e.g. bench press 33.75kg) — the full pipeline from
confirmed block through to a real generated session. Re-calling confirm
afterward (including with an out-of-range `chosenBlockType`) correctly
no-op'd without writing a duplicate row — the double-submit guard fires
before the allowlist check even runs.

**Real gotcha hit during this verification**: the browser tool's
screenshot dimensions (1425×702) don't match the page's actual viewport
(1745×859) on this machine, so a raw pixel coordinate read off a
screenshot can silently miss its target and land on the wrong element —
happened here (a "Shift to Deload" click landed on "Keep training
Hypertrophy" instead, briefly looking like a real gate/confirm bug
before a direct API call proved the server logic was correct). Fix:
click via the element's `ref` from `read_page`/`find`, not raw
screenshot-derived coordinates.

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
narration. One pre-existing, unrelated bug surfaced during testing and
left as-is (out of scope for this change): React Strict Mode's dev-only
double-effect-fire can race two concurrent `POST /api/member/workout/
generate` calls on first load, occasionally hitting `workout_sessions`'
`booking_id` unique constraint and returning a 500 — reloading recovers
cleanly since one of the two racing inserts always succeeds; worth a
proper fix (an idempotency lock or a client-side guard against a
duplicate in-flight request) if it turns out to affect production, which
doesn't double-invoke effects the way dev does.

## Wearable integration research — Google Health API note — 2026-08-24

Not built, just documented for whenever this gets prioritised (Fitbit
was previously flagged as real wanted scope, a research spike not yet
started). Confirmed via live web search: Fitbit's legacy Web API is
being shut down **September 2026** — any future integration should
target the **Google Health API** directly (reached general availability
May 2026), not the old Fitbit endpoints, since OAuth tokens don't
transfer between them regardless of which is targeted first. **Health
Connect** (Android's on-device data layer) stays a separate thing and is
still native-only — same constraint the Coach hub's "Tech integrations"
placeholder already states for Apple Health.

Real nuance on "is there truly no way around it": **Apple Health/HealthKit
has zero cloud API by design** (Apple's own privacy stance, not a gap
that'll close) — that data only ever comes from a native (or
Capacitor-wrapped) app with real HealthKit entitlements, no workaround.
**Health Connect is less absolute**: if the underlying wearable brand
(Fitbit, Garmin, Whoop, Oura) has its own cloud API, that data is
reachable straight from the device maker's API without ever touching
Health Connect at all — Health Connect only matters for a source with no
cloud counterpart of its own. The realistic middle path if this gets
prioritised before a full native rebuild: wrap the existing PWA in a thin
native shell (Capacitor or similar) purely to get real HealthKit/Health
Connect entitlements, reusing nearly all of today's code rather than a
ground-up rewrite — matches the "high probability of an eventual native
app" Carl already flagged as likely once this is battle-tested.
