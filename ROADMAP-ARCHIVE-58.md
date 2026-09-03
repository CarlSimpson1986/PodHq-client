# Archive 58 — Real icon restored, tour extended cross-page (2026-09-02)

Split out 2026-09-03 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, fully resolved
and superseded by later tour rework the same/next day. Reference-only,
not `@`-included anywhere.

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
