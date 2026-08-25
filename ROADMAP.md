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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-18.md`, covering the pilot
mechanism proof (2026-08-05) through the full initial build of the
flat-tab member app redesign (2026-08-25) — all split out to keep this
file within Claude Code's ~15,000-character `@`-import limit. Archives
aren't always the strictly oldest material — the split point is "what's
finished and stable" as much as "what's oldest" (see
`ROADMAP-ARCHIVE-14.md`'s, `-15.md`'s, `-16.md`'s, `-17.md`'s, and
`-18.md`'s own header notes for five same-day examples of this). All
archives are reference-only (not auto-loaded by CLAUDE.md); check them
for full stage-by-stage build history, or `git log` on this file for the
exact split points. This file's active content is the redesign
follow-up (2026-08-25) plus whatever's added after it. If this file
grows too large again, split it the same way: move whichever section is
most clearly finished (not necessarily the chronologically oldest) into
a numbered `ROADMAP-ARCHIVE-19.md`, leave a pointer note at the top of
this file, and update this paragraph.

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

## Nav-context-switch fix + nav-lag investigation — 2026-08-25 (same day, evening)

**Nav-context-switch bug**: Carl reported "the leaderboard needs to be on
the homescreen — when you click on it...it goes to the coaching
dashboard." The link itself was fine; the actual issue was that
`/health` and `/leaderboard` (universal pages, reachable from `MoreMenu`
off both the main app's Home and the Coach area) were rendering
`MemberBottomNav` (Dashboard/Training/Nutrition/Coach) instead of the
main app's `BottomNav` (Home/Book/Coach/Shop/Profile) — landing on the
Coach-area's 4-tab bar read as being dropped into "the coaching
environment" from what's meant to be a universal feature. Fixed by
switching both pages to `BottomNav`. Committed `ce921b2`.

**Nav-lag investigation** ("bottom nav lots of lags...switching through
icons"): measured live via network capture rather than guessing, and
found two separate real issues, not one.

1. **Prefetch storm, fixed**: Next's default `Link` behaviour eagerly
   prefetches every link visible in the viewport. `/dashboard` alone has
   7 such links (`MemberBottomNav`'s 4 + `/coach`, `/coach/checkin`,
   `/leaderboard`, `/book` cards) — every one a fully dynamic,
   session-gated route doing several Supabase queries server-side even
   for a prefetch. Landing on Dashboard was firing ~14 background RSC
   requests (a duplicated double-batch) that don't correspond to
   anything the member asked for, competing with real navigations for
   serverless concurrency. Added `prefetch={false}` to `MemberBottomNav`,
   `BottomNav`, `MoreMenu`, and every card `Link` on `/dashboard`.
   Verified live, before/after: the same tab click that fired 14 phantom
   prefetch requests before the fix fires zero after it. Committed
   `a273e36`.

2. **RSC-navigation 503s — investigated, ruled out as a false lead**:
   during live testing, every real client-side navigation's own RSC
   request (not a prefetch — the actual fetch Next's router makes when
   you tap a tab) appeared to return a 503 in the browser's network
   panel, immediately followed by a full hard-reload fallback — a
   plausible second lag mechanism, so it was written up as a live
   finding with `src/proxy.ts`'s unguarded `supabase.auth.getUser()` call
   flagged as the leading suspect. Carl checked Vercel's own request logs
   for the same window afterward and found no 503s at all, only 200s —
   and the same browser session had also logged an unrelated 503 from
   `fonts.gstatic.com` (a Google CDN with no connection to this app),
   pointing at the sandboxed browser-automation tool's own network layer
   as the actual source of both, not a real server-side failure. No code
   changed as a result of this lead (correctly, in hindsight) — the
   prefetch-storm fix above is the confirmed, real fix for the lag
   report; `proxy.ts` is not a suspect.

## Client-side page cache for bottom-nav tabs — 2026-08-25 (same day, later)

Carl still noticed a slight residual lag and asked whether a native app
would be less laggy; the honest answer was "somewhat, but mostly because
native screens don't wait on a network round trip to render the nav
shell" — closeable on the web side with a client cache instead of a
native rewrite. Carl asked for that cache layer.

Enabled via Next 16's built-in `experimental.staleTimes.dynamic: 30` in
`next.config.ts` — once a member has visited a dynamic page (Dashboard/
Training/Nutrition/Coach etc.), Next's in-memory Client Router Cache
reuses that RSC payload for 30s on revisits instead of re-fetching, so
bouncing between recently-visited bottom-nav tabs feels instant. No page
components changed — this is pure Next router config, still fully
server-verified Server Components, no client-side Supabase queries
(CLAUDE.md's rule intact).

**Real risk found and fixed before enabling it**: the Client Cache is
in-memory per browser tab, keyed by route, not by member. Per Next's own
docs, `router.refresh()` only clears the cache for its *own* destination
route, not other previously-visited ones, and nothing at all clears it on
a plain `router.push()`. Every one of this app's auth-identity-changing
navigations (login, both logout entry points, password reset, magic-link
callback) used exactly that pattern — meaning a member logging out and a
different member logging in on the same device within that 30s window
could have briefly been served the first member's cached Dashboard/
Training/Nutrition data. Same bug class as the 2026-08-16 OWASP finding
that made `public/sw.js` allowlist-only, just via Next's router cache
instead of the service worker's. Fixed by switching all five of those
transitions from `router.push`/`router.refresh` to a real
`window.location.href` navigation — the Client Cache is documented as
"cleared on page refresh", which a full reload guarantees outright.
Touched files: `login/page.tsx`, `reset-password/page.tsx`,
`auth/callback/page.tsx`, `profile-view.tsx`, `no-member-profile.tsx`.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98),
`next build` all clean. Live: logout confirmed landing cleanly on
`/login` with a real full-page reload (not a client transition). Login/
reset-password/callback weren't re-tested live (no test-account password
in this session) but follow the identical, now-proven pattern.
