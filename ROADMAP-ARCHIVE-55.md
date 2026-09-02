# Archive 55 — Trial preview copy strengthened (2026-09-02)

Split out 2026-09-02 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## Trial preview copy strengthened — 2026-09-02

Carl: give members more reasons to actually start the 7-day trial. The
existing tap-through preview (`trial-banner.tsx`, already built — not a
new flow) had 3 generic bullets from before nutrition tracking and the
research-grounded Pod Coach chat existed. Rewrote all 4 to be specific
and current, and added an explicit "Full Premium access for a week — not
a stripped-down preview" line, since `getCoachHomeState` already treats
`trial_active` identically to `subscriber` everywhere else in the app —
no pricing shown (this component has no access to catalog pricing, and
"free/no card" is the stronger anchor already on screen).

**Verified**: `tsc --noEmit`/`eslint` clean, confirmed live in local dev
via a synthetic test member. Note for next time: the PWA service worker
(`public/sw.js`) served a stale cached Home page mid-test even after a
fresh `next dev` + cleared `.next` — unrelated to this change, but real;
`navigator.serviceWorker.getRegistrations()` + unregister + `caches`
clear fixed it (hit again, same fix, on the follow-up copy pass below).

**Second pass, same day**: Carl, after actually reading the modal live —
"it's not just your free AI Coach trial, it's a free upgrade to
Premium." Reframed the header ("Free upgrade to Premium") and subtitle
around that positioning, and swapped the 4 bullets from feature-level
copy to outcome-level selling points: personalised coaching journey,
accountability, results, wearable sync. Same `tsc`/`eslint`/local-dev
verification as the first pass.
