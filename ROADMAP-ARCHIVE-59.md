# Archive 59 — Pod Assist tour: glow, order, Done/X fix (2026-09-03)

Split out 2026-09-03 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, fully resolved
and verified. Reference-only, not `@`-included anywhere.

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
