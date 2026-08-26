# ROADMAP Archive 20 — Nav-context-switch fix + nav-lag investigation (2026-08-25)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day nav-context-switch bug fix and the
nav-lag investigation (prefetch storm fixed; RSC-navigation 503s
investigated and ruled out as a sandboxed-browser-tool artifact, not a
real server-side issue) — fully shipped and verified, superseded as the
day's active thread by the client-side page cache work that remains in
`ROADMAP.md`.

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
