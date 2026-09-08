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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-67.md`, covering the pilot
mechanism proof (2026-08-05) through the email/Android/rest-timer session
(2026-09-07) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Decline-detection" (2026-09-08). If this
file grows too large again, split it the same way: move the most clearly
finished section into `ROADMAP-ARCHIVE-68.md`, update this paragraph.

## Decline-detection — built and verified — 2026-09-08

Designed and approved the night before (2026-09-07, Carl stopped before any code was written), implemented exactly to that plan this session with no changes to the approved rule or scope.

**Scope, per Carl's own decisions**: core compound lifts only (bench/rows/squats — whatever the block's rotation picked), not accessories; **message only for v1** — a check-in banner, no "start a deload" button; scientifically grounded, not an arbitrary number.

**The rule**: raw weight can't be compared across sessions here since the rep target itself changes across a block's 4-week phase, so weight is normalized via **estimated one-rep-max** (Epley: `e1RM = weight_actual_kg * (1 + reps_actual / 30)`). e1RM across the lift's **last 3 real appearances** (not calendar sessions — an A/B/C rotation means a lift doesn't run every session) must be non-increasing overall with at least one genuine decrease — AND the newest RPE isn't lower than the RPE from 2 appearances ago (missing RPE treated as "didn't ease off," erring toward the harmless dismissible banner over missing a real signal). The RPE check is what distinguishes a member's own deliberate back-off (output and effort drop together) from real overreaching (output falls while effort holds or rises).

**Built exactly to the 8-step plan**: `coach-profile.ts` gained `ExerciseAppearance`/`ExerciseTrend` types and a `trends: ExerciseTrend[]` field on `getWorkoutHistory()`'s return — a second reduction pass over the same already-fetched sessions/exercises/sets data (no new query), newest-first, capped at 4 appearances per key; `ExerciseHistoryEntry` itself untouched. `types.ts` gained `DECLINE_CHECK_HISTORY_LOOKBACK_SESSIONS = 15`, used only by `generateAndPersistSession`'s `getWorkoutHistory` call (swapExercise and the post-session preview keep the default 6) — needed because a lift under an A/B/C rotation only appears in roughly 1 of every 3 sessions, so 6 sessions risked catching fewer than the 3 real appearances the rule needs. New `decline-detection.ts` — `estimateOneRepMax()`, `detectDecline(trend)`, `findDeclineAlertExerciseKey(plan, trends)` (compound-only via `EXERCISE_CATALOG.isCompound`, first qualifying match in plan order — a documented v1 simplification if two compounds decline at once). `generateAndPersistSession` computes `declineAlertExerciseKey` once the plan is built and writes it to the new `workout_sessions.decline_alert_exercise_key` column at insert time (podHq migration `0094_workout_decline_check.sql`, one nullable text column, no CHECK constraint) — the concurrent-request race-recovery branch needs no change, since `loadSessionDetail` now selects the column directly off whichever session row won. `loadSessionDetail`/`WorkoutSessionDetail` (both the server type in `workout-session.ts` and the client's own duplicate interface in `workout-view.tsx`) thread the field through. The overview screen shows the existing low-recovery banner's exact visual/dismiss pattern, one "Got it" button only: *"Your {exercise name} has dropped the last 3 times you did it — everything ok? Might be worth a deload week."* — exercise name read off `detail.exercises`, not a separate catalog lookup.

**`decline-detection.test.ts`, 12 cases** (one more than planned — split "no compound in the plan is declining" out from "no trend data at all"): genuine decline; decline-but-RPE-also-eased-off (not flagged); too little history; an up-tick resetting the signal; a rep-target change that lowers weight but raises e1RM via higher reps (not flagged); a flat tie between the two newest appearances still counting as non-increasing; missing-RPE still flagging; accessory never flagged even when genuinely declining; first-compound-wins in plan order; no trend data for a plan exercise; no compound in the plan declining; an Epley-formula spot-check. One test fixture bug caught and fixed before it shipped: the "not declining" case had appearances in the wrong order for a newest-first array (ascending weight by array position is actually a *real* decline read backwards through time, not an improving trend) — corrected to descending-by-array-position (64→62→60) to genuinely represent weight climbing session over session.

**Verified**: `tsc --noEmit`, eslint (all 6 changed/new files), `npx vitest run` (217/217, up from 195), and `npm run build` all clean. **Not yet applied live** — migration `0094` needs Carl to run it via Supabase's SQL Editor, and the banner itself hasn't been confirmed against a real declining trend end-to-end (a real 3-appearance decline takes actual logged sessions over time to occur naturally — Carl to seed/confirm when convenient, not blocking).

## Decline-detection verified live, Seated Row renamed, wger rejected — 2026-09-08, same day

Migration `0094` applied. Real local-dev browser verification rather than trusting the code alone: member 123 (the old seeded test account) no longer existed — swept up in the 2026-08-22 `members` wipe — so found the real current one (151, "Dev Test Member," Hove), checked its actual history first, then seeded a genuine 3-appearance decline on **Seated Row** specifically (an exercise it had never done, avoiding any collision with its 2 real Barbell Bench Press appearances). New disposable scripts in `scripts/` (seed/remove/grant-credit/find-test-member), same convention as the existing member-123 demo-data scripts.

**A real false alarm, chased down rather than assumed fixed by restarting things.** The banner didn't appear on several checks despite the API confirming `declineAlertExerciseKey: "seated_row"` every time. Ruled out in order: stale `.next` cache (full restart, no change), a stale client bundle (grepped every loaded script for the banner's own text — genuinely absent once, present after a clean rebuild), and a hung mount effect (`generate()`'s on-mount fetch simply never fired on some loads — `performance.getEntriesByType('resource')` showed zero API calls). Root cause: **Chrome throttling a backgrounded automation tab's JS**, not a code bug — a single click un-froze it. With a properly rendered page, a temporary render-time `console.log` confirmed every condition (`hasProgress: false`, `declineAlertExerciseKey: "seated_row"`, `declineAlertDismissed: false`) was already correct, and the banner then rendered exactly as designed, dismiss included. Debug logging removed before committing; `git diff` confirmed a clean match against the already-committed file.

**A real content gap surfaced mid-test**: `exercise-catalog.ts`'s `seated_row` entry never said which cable setup it needs — Hove's is dual-pulley specifically, not the single-pulley alternative the one generic `cable_machine` equipment type also covers (Carl's own 2026-08-24 call: that nuance belongs in exercise copy, not a new filterable dimension). Renamed to "Dual-Pulley Seated Row" with an updated safety tip, matching the existing `lat_pulldown_v_grip`/`lat_pulldown_double_handle` naming convention. Separately, neither Seated Row nor Standing Cable Row had a real video, only the fallback demo photo — Carl filmed and uploaded a real one for Standing Cable Row mid-session (confirmed live via this repo's own `/api/exercise-videos` endpoint). Seated Row stays in the catalog, flagged as still needing a video.

**wger evaluated as a royalty-free image/GIF fallback source, real research not a guess, then rejected.** Its software is AGPL-3.0 (irrelevant, not being deployed); its exercise *data* — images included — defaults to CC-BY-SA 3.0 set **per individual exercise**, meaning real attribution requirements and no blanket license, needing a manual per-exercise check plus an attribution UI rather than a quick wire-up. Scoped honestly as a real feature, not built ad hoc — Carl's call after seeing this was to drop it entirely (confirmed his objection was wger's own content quality, not just the licensing overhead).

**Cleanup**: fake seeded appearances, the one real session/booking the test generated (known exactly from API responses, not guessed), and both credit ledger rows (grant + spend) removed live by Carl — member 151's balance nets back to zero, no leftover test data.
