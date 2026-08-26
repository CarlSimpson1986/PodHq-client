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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-19.md`, covering the pilot
mechanism proof (2026-08-05) through the redesign follow-up work (Coach
restructure, leaderboard, training nudge — 2026-08-25) — all split out to
keep this file within Claude Code's ~15,000-character `@`-import limit.
Archives aren't always the strictly oldest material — the split point is
"what's finished and stable" as much as "what's oldest" (see
`ROADMAP-ARCHIVE-14.md`'s, `-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s,
and `-19.md`'s own header notes for same-day examples of this). All
archives are reference-only (not auto-loaded by CLAUDE.md); check them
for full stage-by-stage build history, or `git log` on this file for the
exact split points. This file's active content is the equipment-aware AI
Coach work (2026-08-24) plus whatever's added after it. If this file
grows too large again, split it the same way: move whichever section is
most clearly finished (not necessarily the chronologically oldest) into
a numbered `ROADMAP-ARCHIVE-20.md`, leave a pointer note at the top of
this file, and update this paragraph.

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

**Update, same day**: spotted a leftover unguarded `/book` prefetch on
Training while checking the above and swept the rest of the codebase for
the same original prefetch-storm pattern — Training's next-session card,
Health's Nutrition/Training cross-links, Coach's check-in card, Home's
leaderboard card, and the shared `ai-coach-section.tsx`/
`recovery-status-card.tsx` components (rendered on Home/Dashboard/Health)
all still had eager prefetch on. Same fix, all now `prefetch={false}`.

## POD chat fixes: dead in production, invisible input text, tour-replay chip — 2026-08-26

Carl reported the "?" chat ("POD", `help-chat-view.tsx` /
`src/lib/help-bot.ts`) didn't work at all live, plus the chat's own text
input showed typed text in white (invisible against the panel).

**Root cause of the dead chat — not a code bug**: `askHelpBot` throws if
neither `GROQ_API_KEY` nor `ANTHROPIC_API_KEY` is set, and podhq-client's
Vercel project had never had either — `GROQ_API_KEY` was only ever
configured for the sibling `../podHq` project, and (being a fully
separate Next.js app/deploy per this file's own header) podhq-client
needed its own copy, which it never got. Confirmed locally first (a
throwaway Node script loaded `.env.local` and called the real Groq
endpoint directly — 200 OK, valid reply — ruling out the prompt/logic
itself), then confirmed via `vercel env ls production` that the key was
absent from this project specifically. Fixed by adding `GROQ_API_KEY` to
this project's Production (and initially Preview, though Carl later said
Vercel only let him pick one scope at a time when he went to configure
it himself, so Preview may still need doing manually — Production is
what live members hit and is confirmed set).

**Invisible input text**: `help-chat-view.tsx`'s `<input>` never set a
text colour, so — sitting inside the white `.card-light` panel while the
rest of the app is dark-themed white-on-black — it inherited the global
white body colour with no background override, i.e. white text with no
opaque background under it. Fixed by adding `text-card-light-foreground`
(the pattern already used in `buy-credits-list.tsx` etc.).

**"Replay app tour" as a chat question**: added a quick-question chip
row shown when the chat is empty — "Replay app tour" plus the 3
`FAQ_ITEMS` questions. Tour replay is a UI action the LLM can't perform,
so that chip bypasses the API entirely and calls the same `driver.js`
`.drive()` the existing "?" menu item already uses, via a new
`onReplayTour` prop passed down from `onboarding-tour.tsx`; the FAQ
chips send their question straight into the existing chat flow.

**Verified**: `npx tsc --noEmit` and `eslint` on both changed files clean.
Not yet re-tested live post-deploy (no test-account password in this
session, same limitation as the 2026-08-25 client-cache session).

**Friction, worth noting**: this session ran `vercel env ls production`
to diagnose the missing key, which surfaces variable *names* (not
values — Vercel's CLI shows `Hidden` for every value). Carl reacted
strongly to seeing even just names of production env vars in the
conversation without being asked first, despite no value ever being
displayed or logged. Going forward: always ask before running any
`vercel env ls/add/rm` (or equivalent) against either Vercel project,
even for a read-only names-only listing.
