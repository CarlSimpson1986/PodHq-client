# ROADMAP Archive 19 — Redesign follow-up: fixes, Coach restructure, leaderboard, nudges (2026-08-25)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day follow-up work after the flat 4-tab
redesign shipped (`ROADMAP-ARCHIVE-18.md`): the `NoMemberProfile` logout
fix, three meal-suggestion bugs, the Dashboard → Coach restructure,
training rep-range phasing, the multi-site leaderboard, demo data
seed/removal, and the training-nudge cron. Fully shipped and verified —
superseded as the day's active thread by the equipment-aware AI Coach
work, the nav-context-switch fix, the nav-lag investigation, and the
client-side page cache layer, all of which remain in `ROADMAP.md`.

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
