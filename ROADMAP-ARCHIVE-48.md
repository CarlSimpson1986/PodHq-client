# Archive 48 — Stage 4 of custom workouts: HIIT interval timer + reps tally (2026-08-30)

Split out 2026-08-30 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## Stage 4 of custom workouts — HIIT interval timer + reps tally — 2026-08-30

Fourth Cardio sub-format alongside AMRAP/RFT: a real work/rest interval
timer (member sets work seconds, rest seconds, round count, rest-between-
rounds seconds; the app cycles through the picked exercises automatically).
Migration `0074_workout_hiit.sql` (podHq, shared DB) adds only
`work_seconds`/`rest_seconds`/`rest_between_rounds_seconds` — reuses
`target_rounds`/`rounds_completed`/`elapsed_seconds` from AMRAP/RFT
unchanged. v1 has no early-exit/DNF (always completes every prescribed
round), so completion needed no self-report at all — a plain "I finished"
POST, server-computes `elapsed_seconds` from the stored prescription,
never trusts the client.

The sequencer (`workout-view.tsx`) is a small state machine — round,
exercise index, sub-phase (work/rest/rest-between-rounds) — ticked every
second via `setTimeout`, same pattern AMRAP/RFT's own timers use. Hit
`react-hooks/set-state-in-effect` when every branch's setState ran
synchronously in the effect body; fixed by moving the whole transition
into the same `setTimeout` callback as the 1s tick (0ms delay when a
transition is due immediately) rather than calling it inline.

**Reps tally, added same day** after Carl asked "would you not want to
track how many of each you did in the 30s?" — HIIT's auto-completion
gave a member nothing to look back on. New optional post-completion
screen (never blocks or delays the automatic completion above) logs one
number per exercise into `workout_sets.reps_actual` — the same column
every other format already uses, no new schema.

**Found and fixed along the way**: the "Start" button on a *resumed*
HIIT session (one generated in an earlier page load) wasn't syncing
`hiitWorkSeconds`/`hiitRestSeconds`/`hiitRounds`/`hiitRestBetweenRoundsSeconds`
from the server — it silently ran the component's useState defaults
(30/15/4/30) instead of what was actually generated. Now seeded from
`detail` on every Start tap, not just the one where the builder was used
in the same render.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean throughout. Live-verified twice on the
playground member/booking — full work→rest→work→rest-between-rounds→
next-round cycling, terminal auto-completion, and the reps-tally screen
(one exercise logged, one left blank, confirmed both the DB write and
the "skip if blank" behaviour). The first live-test attempt appeared to
skip the tally screen entirely; root cause was a stale service-worker
cache serving pre-tally JS, not a code bug — confirmed by diffing the
actual served chunk against source, then reproduced correctly after
clearing the SW/cache.

**Not built this stage**: pause/skip/early-exit; per-exercise weight;
warm-up/cool-down toggle for HIIT (matches AMRAP/RFT's own omissions).
