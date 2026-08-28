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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-38.md`, covering the pilot
mechanism proof (2026-08-05) through "Weekly check-in: data review + AI
narrative + reflection questions" (2026-08-28) — all split out to keep
this file within Claude Code's ~15,000-character `@`-import limit.
Archives aren't always the strictly oldest material — the split point is
"what's finished and stable" as much as "what's oldest" (see each
archive's own header note for examples). Reference-only, not
auto-loaded by CLAUDE.md; check them for full build history, or `git
log` on this file for exact split points. Active content here starts at
"Health page redesign" (2026-08-28). If this file grows too large again,
split it the same way: move the most clearly finished section into
`ROADMAP-ARCHIVE-39.md`, update this paragraph.

## Health page redesign: one card per metric + weekly/monthly averages — 2026-08-28

Carl: the Connection card's flat 2x2 grid (steps/sleep/RHR/HRV) and each
metric's own expandable trend card below it were showing the same four
numbers twice — wanted the top grid gone, one card per metric, each with
a weekly and monthly average. Connection card (`wearable-connection-card.tsx`)
is status-only now: connect/refresh/disconnect plus a "last synced"
line, no more duplicate stats. Every metric — Steps, Sleep, Resting
heart rate, HRV — gets exactly one card. Sleep got a real trend card for
the first time (`formatAs="duration"` on `HealthMetricCard`), replacing
what had been a static "not available" placeholder until the sleep-sync
fix earlier the same session.

`averageInWindow` (`wearable-averages.ts`) — a pure, tested function
computing a 7-day/30-day average over already-fetched trend points,
London-calendar-dated (`londonDateString`/`addLondonDays`) same as every
other day-window calc in this app rather than a naive UTC subtraction.
`getRecentWearableSnapshots`'s fetch window widened from 14 to 35 days
so the 30-day average has real range to compute from. 6 new tests.

**Shipped a real production crash, caught and fixed live**: the first
version passed `format={formatSleepDuration}` — a plain function — from
`health/page.tsx` (a Server Component) into `HealthMetricCard`
("use client"). Next.js can't serialize a function across that
boundary; the failure surfaces in production as an unhelpful generic
error (minified React #441, "error occurred in the Server Components
render"), not a clear message. Neither `tsc` nor `next build` catch this
at all — it's a Next.js RSC runtime constraint, not a TypeScript type
error, so the first deploy looked completely clean by every automated
check and then crashed the live page. Caught only by actually loading
the deployed page rather than trusting green checks. Fixed by replacing
the function prop with a string flag (`formatAs: "duration"`) that
`HealthMetricCard` resolves to its own local formatter — safely
serializable, same visual result.

**Verified live** (both the redesign and the fix): all four cards
render correctly against the real connected account with real averages
(steps 7-day/30-day both 21,438 given only 3 real days of history;
sleep "7h 7m" for both windows; RHR 61bpm; HRV correctly showing "—",
no data at all yet), the Steps card's trend expand/collapse still
works, and the browser console is clean. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (120/120, 6 new), and `next build` all clean throughout
(worth noting again: none of those caught the actual bug that shipped).

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
