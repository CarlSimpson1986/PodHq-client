# Archive 40 — Weekly habit + streak, and the daily-habit-system scoping session (2026-08-28)

Split out 2026-08-29 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest sections in that file at the time, finished and
verified live. Reference-only, not `@`-included anywhere.

## Persistent weekly habit + streak, feeding the Coach recommendation — 2026-08-28

Carl asked for a 5th check-in question ("What's one habit that's going
to push you forwards this week?") and then, mid-build, whether it
should feed "the member's main effort" — the existing `getWeeklyRecommendation`
"This week's focus" card on the Coach tab (2026-08-25), previously
100% system-derived, never member input.

**Scoped the priority placement before building**: confirmed with Carl
that the member's stated habit sits below the existing `prioritise_sleep`
recovery/safety flag (a live signal from this week's real data must
never be silently replaced by a self-statement made possibly days
earlier — same principle checkin-state.ts and the exercise catalog's
injury filtering already hold) but above the generic nutrition/protein
nudges. `hit_sessions`/`prioritise_sleep`'s own existing relative order
was left untouched — only the new `member_habit` tier was inserted, no
unrelated reordering.

Replaced the vague, optional "one thing to focus on next week?" (low
real usage, and now redundant) with the new required habit question —
required because an empty habit would silently break both the
recommendation feed and the new streak.

**New "Your habit" card** (`member-habit-card.tsx`) on the Coach tab,
always visible, showing the current commitment plus a streak.
`habit-streak.ts`'s `computeHabitStreak` — pure, tested — counts
consecutive weeks (no skipped period, non-empty habit) back from the
most recent check-in. Deliberately "weeks running you've SET a habit",
not "weeks you actually kept it up" — no self-report mechanism exists
to verify the latter, and this app doesn't claim what it can't back
(same principle as recovery-signal.ts never inventing a number).

**Carl then floated a much bigger, different feature** mid-build — a
daily habit checklist (water/steps/fruit etc.), member-set and/or
goal-based recommended habits, a Coach-tab layout with nutrition/workout
surfaced directly and check-in/leaderboard below, and questioned whether
training blocks are still needed. Correctly identified as a separate,
substantially larger project (new data model, new daily-tracking UI, a
real IA redesign, an actual architecture question) rather than an
extension of the single weekly habit — finished the smaller, already-
scoped piece first; the daily-habit-system idea is unstarted, needs its
own proper scoping pass.

**Verified live**, not just build-clean — and this time double-checked
after the Health-page deploy's crash lesson: confirmed the "Your habit"
card via `get_page_text` (a screenshot mid-deploy-propagation looked
like it was missing entirely; the DOM actually had it, just a rendering/
timing artifact in the screenshot, not a real bug). Full round-trip
tested on the real connected account: backdated `coach_profiles.created_at`
to force overdue, submitted a real check-in with a habit answer,
confirmed the exact row in `check_ins.answers`, confirmed "Your habit"
updated on the Coach tab with the correct "set this week" copy, and
confirmed "This week's focus" correctly still showed the higher-priority
`hit_sessions` nudge rather than the member's habit (proving the
priority chain works as designed) — then cleaned up both the backdated
timestamp and the test check-in row. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (134/134, 14 new), and `next build` all clean throughout.

## Daily-habit-system scoping session + two concrete fixes — 2026-08-28

Carl floated a much bigger idea mid-build on the weekly habit: a daily
habit checklist (water/steps/fruit etc., check-off plus counted
targets), member-set and/or goal-recommended habits, and a Dashboard/
Coach layout rework. Scoped via questions rather than guessed:
check-off+counted mix confirmed, coexists with (doesn't replace) the
weekly "Your habit" card, lands as a Dashboard card near the top. The
full recommended-habit catalog and exact daily-tracking data model are
still open — this was scoping, not yet a build.

Two concrete, already-clear items got built and shipped in the same
pass rather than waiting:

**Hypertrophy rep-target correction**: Carl — "when I said between
10-12 reps I didn't mean 11 reps." `REP_TARGET_BY_BLOCK_PHASE.hypertrophy`
was literally the midpoint of each stated range (`[7, 11, 17]`) — not a
number anyone programs. Confirmed the new values aren't a smooth curve
before changing anything (12 → 6 → 15, a heavier/lower-rep *middle*
phase, deliberately not ascending) and confirmed weight computation has
no hidden coupling to rep target (purely RPE-history-driven) before
shipping. Also fixed stale `~10-12 reps`-style copy in the training-block
API route that would have drifted from the real generated numbers.

**Dashboard training-block card removed**: turned out `/training`'s own
"Current training block" section already showed the full phase/rep
detail — Dashboard's small summary was a pure duplicate, not a
different view, so "move it to Training" was really "delete the
Dashboard copy."

**Still open, not built**: showing upcoming workout content before a
member books a session ("Next session" on `/training` currently only
shows anything once a booking exists) — real mechanism choice between
eagerly generating the A/B/C template set at phase start vs. a read-only
preview computed on demand, not decided yet. And the full daily-habit
checklist itself.

**Verified live** (not just build-clean, per the Health-page crash
lesson): both fixes confirmed on the real deployed site — Dashboard's
training-block card gone, `/training` showing "Phase 2 of 3 · Weeks 5-8
— 6 reps" (the corrected value). `npx tsc --noEmit`, `eslint`,
`npx vitest run` (134/134), and `next build` all clean throughout.
