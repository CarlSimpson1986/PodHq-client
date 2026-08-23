# PodHQ Client — Archive 4: Guided Tour & Static FAQ (POD phase 1)

Reference-only, not `@`-included by CLAUDE.md. Split out 2026-08-23 to keep
`ROADMAP.md` within Claude Code's ~15,000-character import limit. Covers
2026-08-21: the guided first-login tour (POD phase 1) and the same-day
static FAQ follow-up, before POD phase 2 (the real LLM chat bot,
2026-08-22) superseded the static FAQ. See `ROADMAP.md` for the active log
and the other archives (`ROADMAP-ARCHIVE.md`, `ROADMAP-ARCHIVE-2.md`,
`ROADMAP-ARCHIVE-3.md`) for earlier history.

## Guided first-login tour ("POD"), phase 1 — 2026-08-21

First piece of the "POD" onboarding/FAQ assistant idea
(see podHq's memory notes — nothing previously built). Scoped down after
discussion with the user: build the scripted guided-tour half now, ahead
of Hove's launch, and defer the FAQ-bot half — a full RAG/tool-calling
agent isn't clearly needed yet for a single small gym, and a cheaper
static-FAQ version should ship first if/when real usage shows people
need it, rather than building the fancier version speculatively.

**Library: `driver.js`** (MIT-licensed, ~5kb, no dependencies) — chosen
over Intro.js (dual-licensed, needs a paid commercial license for a
business app) and Shepherd.js (heavier, no clear advantage here for a
mobile PWA).

**Persistence**: `members.tour_completed_at` (nullable timestamptz,
`0045_member_tour.sql` in podHq's shared migrations folder — applied and
verified live). Null means "never seen it" — auto-launches once
regardless of device, then stays off. New `POST /api/member/tour-complete`
route (session-validated, rate-limited, same pattern as every other
member-write route) marks it complete.

**v1 scope: home screen only**, deliberately not cross-page, to avoid
tour-state-across-navigation complexity for a first version: greeting →
credits available → next-session card → Book/Shop/Profile bottom-nav
icons → a persistent "?" button (`onboarding-tour.tsx`) that replays it
on demand afterward. That same "?" button is the intended future home for
the FAQ bot half of POD once that gets built — confirmed with the user
this is the same icon from the original scoping, not a new one.

**Verified live end-to-end** via a throwaway test member
(`podhq-test-tour@example.com`, gym: Aylesbury Berryfields) through the
real UI, not just the build: all 7 steps highlighted the correct element
with sensible copy; "Done" correctly wrote `tour_completed_at`; reloading
the page did **not** re-launch the tour; the "?" button correctly
replayed it manually afterward. Test account and verification scripts
deleted after. `npx tsc --noEmit`, `eslint`, and `next build` all pass
clean.

**Known minor inefficiency, not fixed**: the "?" button's `onDestroyed`
handler decides whether to call the completion API from the
`tourCompletedAt` prop captured at mount — correct across page loads, but
if a member manually replays the tour on the *same* page load where they
just completed it for the first time, it re-fires the (idempotent, harmless)
completion POST a second time. Not worth the added complexity of tracking
a separate "already marked" flag for a one-extra-request edge case.

**Same-day follow-up: static FAQ built, the "?" icon now a menu.** Second
half of this session's POD work — the deferred FAQ piece, scoped down to
a genuinely static list (no LLM, no ongoing cost) per the earlier
discussion: build the cheap version first, only invest in a fuller RAG/
tool-calling agent if real usage shows it's needed. Content sourced from
the three questions Hove staff actually report members asking most
(`src/lib/faq.ts`), not guessed — cancellation, the 2-hour booking-credit
cutoff, and the under-16 waiver policy (the last one required reading the
franchisee's actual waiver PDF, which turned out to be a generic adult
waiver template that had never actually been adapted — no age threshold,
no parent/guardian signature line. Flagged to the user directly rather
than drafting FAQ copy off a document that didn't state the real policy;
the real policy came from the user directly, not the document).

New `/faq` page (`faq-view.tsx`, single-open accordion, same auth/
`PageHero`/`BottomNav` pattern as every other member page), and the "?"
button (`onboarding-tour.tsx`) is now a small menu — "Replay app tour" /
"FAQ" — rather than immediately replaying the tour, since both now live
behind the same icon as originally scoped. Replaying the tour from `/faq`
navigates home and force-launches it there via a `?tour=replay` query
param, since the tour's steps target home-screen-only elements.

**Two real bugs found and fixed during live testing, not just built and
assumed working:**
- A hydration-mismatch/ordering bug in the `?tour=replay` handler —
  calling `router.replace()` to strip the query param *before* the tour
  had actually started risked a race where the URL-driven re-render
  interfered with the pending timer. Fixed by only stripping the param
  *after* `driver().drive()` runs, both inside the same `setTimeout`
  callback.
- **A stale service worker serving old JS to the browser even after
  clearing `.next` and hard-reloading** — this app's PWA service worker
  (`sw.js`) was still registered from an earlier local dev session, and
  because Next dev doesn't content-hash chunk filenames the way a
  production build does, a cache-first SW kept serving the exact same
  chunk URL with stale bytes through every reload. Symptom was a
  React hydration-mismatch error showing genuinely old component output
  (the pre-menu-redesign single-button version) fighting the correctly
  updated server-rendered HTML. Fixed for this testing session by
  unregistering the service worker and clearing the Cache Storage
  directly via devtools JS — not a code bug, but a real local-dev gotcha
  worth remembering (same class of issue as Stage 28's stale-chunk note,
  this time traced to its actual root cause rather than just "hard
  reload fixed it").

**Verified live end-to-end** via a second throwaway test member
(`podhq-test-faq@example.com`): "?" menu opens correctly with both
options; FAQ page renders all three questions with accurate content;
accordion correctly shows one answer open at a time; "Replay app tour"
from the FAQ page correctly navigates home and launches the tour there.
Test account and scripts deleted after. `npx tsc --noEmit`, `eslint`, and
`next build` all pass clean.
