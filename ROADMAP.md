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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-57.md`, covering the pilot
mechanism proof (2026-08-05) through the trial-start/distinct-icons work
(2026-09-02) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Onboarding: real icon restored, tour
extended across pages" (2026-09-02). If this file grows too large
again, split it the same way: move the most clearly finished section
into `ROADMAP-ARCHIVE-58.md`, update this paragraph.

## Onboarding: real icon restored, tour extended across pages — 2026-09-02

Carl, furious and right: the earlier icon-differentiation pass had
replaced Pod Assist's actual branded asset (`pod-assist-mark.png`) with
a generic drawn `ChatBubbleIcon` — reverted, `pod-assist-bubble.tsx` uses
the real PNG again (Pod Coach's gold + dumbbell bubble is already
visually distinct on its own, no styling needed on Pod Assist to tell
them apart). Also flagged: the tour used to always end on "tap the '?'
if you get stuck," and that guarantee quietly broke once the welcome
became skippable via "Maybe later" — someone who dismissed early would
never see it anywhere. Fixed by putting it directly in the welcome
message text itself, the one guaranteed-seen touchpoint, not just
buried in a tour step someone might skip.

**The bigger piece**: "THE TOUR SHOULD HIGHLIGHT EACH PAGE AND EACH
FEATURE... HOW TO BUY A CREDIT OR MEMBERSHIP, THE HOW TO BOOK." v1 was
deliberately Home-only (no cross-page steps, see the old note this
replaces). Built real cross-page tour infrastructure instead of just
describing other pages from Home:

- `tour-steps.ts` — the full 10-step sequence as data, each step tagged
  with which route (`/`, `/book`, `/shop`) it belongs to.
- `tour-state.ts` — a sessionStorage pointer to "resume at step N",
  scoped to the tab, cleared on completion or early close.
- `tour-runner.tsx` — drives whichever contiguous run of steps belongs
  to the current page. driver.js's `onDoneClick` vs `onCloseClick`
  distinction (not just `onDestroyed`, which fires either way) is what
  makes "finished this page's steps, hand off to the next page" behave
  differently from "closed early, stop for good" — an early close must
  never force-navigate the member somewhere they didn't ask to go.
- `tour-continuation.tsx` — mounted on `/book` and `/shop`; renders
  nothing on a normal visit, only actually runs `TourRunner` when a
  resume is genuinely pending for that exact page (checked in an effect,
  not during render, so server/first-client-render output stays
  consistently empty and hydration never mismatches).
- New real anchors added: `#tour-book-dates`/`#tour-book-slots` (the
  actual date strip and slot list on `/book`), `#tour-book-credits` (the
  real "Buy more" link — doubles as "how to buy a credit" without a
  separate page hop), `#tour-shop-membership` (the real Memberships
  card on `/shop`). The final step lands on `/shop`'s own
  `#tour-help-button` — every page already carries that id via
  `PodAssistBubble`, so the closing "tap here if stuck" reminder is
  anchored to a real, always-present element, not a one-off.
- `onboarding-tour.tsx` simplified to just launch `TourRunner` at index
  0 when "Show me around" is tapped — the old page-local driver.js
  instance and its own completion-tracking logic are gone, all handled
  by the shared runner now.

**Verified live in local dev**, full walk-through via a fresh synthetic
member, not just types: Home's 4 steps ran correctly (1 of 4 → 4 of 4),
clicking through the last one navigated to `/book` and resumed there
automatically (1 of 4, correctly highlighting the real date strip),
through its 4 steps handed off to `/shop` (1 of 2, real Memberships
card), finished on the real Pod Assist icon there (2 of 2) — confirmed
`tour_completed_at` only got stamped at the very end of that full
sequence, not after Home's portion alone. `tsc`/`eslint` clean throughout.

**Reordered same day, third pass**: Carl, after actually walking the
tour again — "book session before buy a credit" was backwards (you
can't book without credits, so teach that first), and the Shop bridge
copy said "let's get a membership," undermining that Shop covers Credit
Packs too, not just Memberships. `tour-steps.ts` reordered: Home → Shop
(Credit Packs step first, then Memberships) → Book → done, replacing
the old Home → Book (with an inline "buy a credit" aside) → Shop
(membership-only) order. Also restored the "Assist" label chip under
Pod Assist's real icon (`pod-assist-bubble.tsx`) to match Pod Coach's
own "Coach" chip — dropped by mistake when the icon itself was reverted
from the generic drawn version back to the real PNG. Re-verified live
end to end via a fresh synthetic member: Home's 4 steps → Shop's 3
(Credit Packs, then Memberships, then the Book nav bridge) → Book's 3,
finishing on the real Pod Assist icon there — confirmed `tour_completed_at`
only stamps once, at the very end. `tsc`/`eslint` clean.

## Tour: glow, step order, door-access copy, broken Done/X — 2026-09-03

Carl walked the tour live and flagged four real problems in one pass:
no visible glow around Pod Assist, a distracting full-width pulsing bar
on some steps, an out-of-order step sequence ("2/6 goes from [credits]
to [session card] doesn't flow"), and — the big one — **the popover's
own Done and X buttons didn't do anything**.

**Glow was never actually reachable.** It had been wired as a `glowing`
prop threaded through `OnboardingTour`, which only Home ever had a path
for — `/shop` and `/book` had no wiring at all. Even on Home it was
invisible in practice: driver.js's dimming overlay (`z-index: 10000`)
painted over the icon's old `z-20` wrapper for every step except the one
literally targeting it. Replaced the prop-threading with direct DOM
class toggling in `tour-runner.tsx` (`setPodAssistGlow`, keyed off the
icon's stable `id`, so it works from wherever `TourRunner` mounts — Home,
`/shop`, or `/book` alike) and raised the icon's z-index above driver.js
entirely (`z-[2000000000]`, with `pointer-events-none` on the wrapper and
`pointer-events-auto` on the actual interactive children, so its now-huge
hit area can never swallow a click meant for a popover positioned nearby).
Also dropped the glow from arbitrary highlighted step targets (a `<p>`
spanning the full card width read as a stretched pulsing bar, not a
highlight) — scoped to just the Pod Assist icon, per Carl's call.

**Step order** (`tour-steps.ts`) reordered to match Home's actual
top-to-bottom layout — was greeting → credits (bottom of page) → session
card (back near the top) → leaderboard → find-professional, now
greeting → session card → leaderboard → find-professional → credits →
shop hand-off.

**Door-access step** now warns members before they book, using the real
rules from `unlock-window.ts`/`api/unlock/route.ts` rather than
undersetting it as automatic: "The door only unlocks from 5 minutes
before your session, and only once you're physically at the gym."

**Done/X root cause** (not a styling issue): driver.js skips its own
default close/advance behavior *entirely* once you supply a custom
`onDoneClick`/`onCloseClick` — your callback is expected to call
`.destroy()` itself. None of `tour-runner.tsx`'s three handlers ever
did. X had been broken on every single step since this was built (its
handler is always overridden); Done only broke on the tour's true final
step (every other "Next" was still hitting driver.js's own untouched
default, which is why step-to-step progress always looked fine).
Fixed by adding the missing `driverRef.current?.destroy()` calls. Also
retargeted the final step at a new non-interactive `#tour-help-label`
span instead of the live, real `#tour-help-button` itself — highlighting
an element with its own click handler in the same corner driver.js's own
popover renders in was exactly the kind of setup that causes buttons to
stop responding.

**Also this session**: `sw.js` had `"/"` in its cacheable-navigation
allowlist — Home is the most member-specific page in the app ("Hello,
{name}"), and caching it directly violated the file's own rule (written
after the 2026-08-16 OWASP audit) that non-public pages must never be
served stale; a deleted/logged-out member's browser could keep serving
their old cached dashboard. Removed, `CACHE_VERSION` bumped to purge the
existing bad cache. Membership/Book-session Home cards restyled to match
the icon-centered layout already used by Leaderboard/Find-a-professional;
Leaderboard, Find-a-professional, and Gift Voucher (which had no tour id
at all) added to the guided tour. Trial banner's collapsed line and the
first-login welcome message copy adjusted for accuracy and tone.

**Verified**: `tsc --noEmit` clean throughout. Glow and step-order fixes
confirmed live in local dev via direct DOM inspection through a full
Home walk-through (six steps, glow `true` on every one). The Done/X fix
was verified live the same way for X (popover and overlay both removed
on click, glow correctly cleared) — the true-final-step Done button
specifically couldn't be exercised end-to-end in this session: reaching
it requires the cross-page resume in `tour-continuation.tsx`, which is
gated on `requestAnimationFrame` and never fired against an automated,
unfocused browser tab (confirmed via `document.hasFocus()` /
`visibilityState: "hidden"` — not a product bug, a limitation of testing
via an unfocused automation tab). Same destroy() fix, proven working for
X; a real end-to-end click-through by Carl is the outstanding check.
