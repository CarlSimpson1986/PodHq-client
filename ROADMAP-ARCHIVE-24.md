# ROADMAP Archive 24 — Cross-gym PAYG booking + Access-log visiting-member fix (2026-08-26)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day cross-gym PAYG booking build (the
first cross-gym stage, PAYG-only — membership was extended to cross-gym
booking in a later same-day stage that remains in `ROADMAP.md`) and the
Access-log visiting-member bug this surfaced in `../podHq`.

## Cross-gym PAYG booking + Access-log visiting-member fix — 2026-08-26 (same day, later)

Prompted directly by the POD chat loop above doing its job: it flagged a
member's "can I use my membership at other gyms?" question as
unanswered, and Carl mentioned a few members had asked this before —
real, repeated demand, not a one-off. Confirmed real policy first:
membership is meant to be locked to one home gym (matches what the app
already does — every booking write is gym-scoped to `member.gym`).
Scoped to **PAYG only** — a subscription membership's `sessions_per_week`
capacity planning assumes members drawn from that gym's own catchment
(same reasoning the leaderboard's per-member streak target already
documents), so opening *membership* access network-wide risks
oversubscribing a popular gym; PAYG credits carry no such assumption —
confirmed the `credits` table has no `gym` column at all, and
`create_booking()`/`cancel_booking()` (`0039_pod_resources_functions.sql`)
already derive gym from the resource row, not from a trusted parameter —
so cross-gym PAYG booking needed **no RPC or migration changes at all**,
only loosening the app-layer restriction that never let a member browse
or book any gym but their own.

**Money stays put**: Carl was explicit — the gym a member buys PAYG
credits from keeps that revenue regardless of where the credit later
gets spent; not touched (`checkout`'s Stripe Connect routing is still
keyed on `member.gym`, unrelated to booking). What he did want: visibility
into which gym actually *hosted* a session, separate from which gym sold
the credits — `bookings.gym`/`waitlist_entries.gym` already capture the
hosting gym correctly once cross-gym booking works (no schema change
needed), surfaced as a "(visiting from X)" tag wherever `../podHq` shows
a booked/waiting member (Calendar's slot detail panel) — full detail in
`../podHq`'s own ROADMAP, including a real pre-existing bug this surfaced
in the Access log.

**Changed**: `/book` accepts `?gym=` for PAYG members only (server-derived
`canSwitchGym` from `getActiveMembership`, not trusted from the client);
`BookingGrid` gained a gym-switcher `<select>` (PAYG-only) and an empty
state for a gym with no bookable resources configured yet.
`/api/bookings` and `/api/waitlist` replaced their "resource must belong
to `member.gym`" check with "must belong to `member.gym`, OR the member
has no active membership" — new `getPodResourceById()` (not gym-scoped,
unlike the existing `getPodResourcesForGym()`) backs this. Booking/
cancellation confirmation emails now say the resource's/booking's own
gym, not `member.gym` — those could silently diverge once cross-gym
booking is possible.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean in both repos. **Not yet tested live** — no
test-account password in this session (same limitation as the
2026-08-25 client-cache session); the underlying mechanism (booking by
`resourceId` alone, gym-agnostic) is exactly what `create_booking()`
already did today for every existing booking, until the follow-up below
extended it further the same session.
