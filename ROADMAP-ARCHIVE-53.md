# Archive 53 — timezone bug in getBookingsForDate/getActiveReservationsForDate (2026-08-30)

Split out 2026-09-02 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## `getBookingsForDate`/`getActiveReservationsForDate` timezone bug fixed — 2026-08-30

The real fix behind the `booking-dates.ts` bug flagged 2026-08-17 (that
one turned out already fixed same day, commit `ed116f3` — a stale note).
Auditing the codebase for the same bug class turned up a genuine live
instance in `src/lib/data/member.ts`: both functions built their day
window with `new Date(date); startOfDay.setHours(0,0,0,0); ...
endOfDay.setDate(endOfDay.getDate()+1)` — local Date accessors, which on
Vercel run in UTC. `date` itself was already a correct London-midnight
instant (from `booking-dates.ts`'s `parseDateParam`), but `setHours(0,
0,0,0)` re-derives "midnight" against the server's own UTC calendar day,
discarding the correct input. During BST (UTC+1, which is now, and lasts
until late October) this shifts the query window a full UTC calendar day
off from the intended London day — `/book`'s "existing bookings for this
day" and "active waitlist reservations for this day" queries could show
the wrong day's data.

Fixed by replacing both with `londonMidnight(date)` /
`addLondonDays(startOfDay, 1)` — the exact same helper pair this same
file already uses correctly in `getTodayBookingForMember` a few dozen
lines up, so this wasn't a new pattern, just two functions that never
got updated when the rest of the file adopted it.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (178/178, no
regressions — these are DB-backed functions with no existing unit test,
and the fix's correctness now flows entirely from `london-time.ts`'s own
already-tested helpers), and `npm run build` all clean. Confirmed no
regression live in local dev (`/book` still rendered today's existing
bookings correctly) — but per this exact file's own header comment, this
bug class only ever reproduces on the real Vercel deployment (UTC
server vs. a UK browser), never in local dev where both run on the same
machine, so a true BST-boundary reproduction wasn't attempted; confident
in the fix because it's a direct reuse of an already-live, already-
correct pattern from the same file rather than new logic.
