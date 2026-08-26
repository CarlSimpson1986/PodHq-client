# ROADMAP Archive 21 — Client-side page cache for bottom-nav tabs (2026-08-25)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day client-cache work: Next's built-in
Client Router Cache enabled for bottom-nav tabs, a real logout/login
identity-leak risk found and fixed before shipping it, and a follow-up
sweep for leftover eager-prefetch links — fully shipped and verified,
superseded as the day's active thread by the POD chat work that remains
in `ROADMAP.md`.

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
