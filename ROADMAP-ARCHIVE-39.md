# Archive 39 — Health page redesign: one card per metric + weekly/monthly averages (2026-08-28)

Split out 2026-08-29 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, finished and
verified live. Reference-only, not `@`-included anywhere.

## Health page redesign: one card per metric + weekly/monthly averages — 2026-08-28

Carl: the Connection card's flat 2x2 grid (steps/sleep/RHR/HRV) and each
metric's own expandable trend card below it were showing the same four
numbers twice — wanted the top grid gone, one card per metric, each with
a weekly and monthly average. Connection card (`wearable-connection-card.tsx`)
is status-only now: connect/refresh/disconnect plus a "last synced"
line, no more duplicate stats. Every metric — Steps, Sleep, Resting
heart rate, HRV — gets exactly one card. Sleep got a real trend card for
the first time (`formatAs="duration"` on `HealthMetricCard`), replacing
what had been a static "not available" placeholder until the sleep-sync
fix earlier the same session.

`averageInWindow` (`wearable-averages.ts`) — a pure, tested function
computing a 7-day/30-day average over already-fetched trend points,
London-calendar-dated (`londonDateString`/`addLondonDays`) same as every
other day-window calc in this app rather than a naive UTC subtraction.
`getRecentWearableSnapshots`'s fetch window widened from 14 to 35 days
so the 30-day average has real range to compute from. 6 new tests.

**Shipped a real production crash, caught and fixed live**: the first
version passed `format={formatSleepDuration}` — a plain function — from
`health/page.tsx` (a Server Component) into `HealthMetricCard`
("use client"). Next.js can't serialize a function across that
boundary; the failure surfaces in production as an unhelpful generic
error (minified React #441, "error occurred in the Server Components
render"), not a clear message. Neither `tsc` nor `next build` catch this
at all — it's a Next.js RSC runtime constraint, not a TypeScript type
error, so the first deploy looked completely clean by every automated
check and then crashed the live page. Caught only by actually loading
the deployed page rather than trusting green checks. Fixed by replacing
the function prop with a string flag (`formatAs: "duration"`) that
`HealthMetricCard` resolves to its own local formatter — safely
serializable, same visual result.

**Verified live** (both the redesign and the fix): all four cards
render correctly against the real connected account with real averages
(steps 7-day/30-day both 21,438 given only 3 real days of history;
sleep "7h 7m" for both windows; RHR 61bpm; HRV correctly showing "—",
no data at all yet), the Steps card's trend expand/collapse still
works, and the browser console is clean. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (120/120, 6 new), and `next build` all clean throughout
(worth noting again: none of those caught the actual bug that shipped).
