# ROADMAP Archive 25 — Cross-gym booking extended to membership members: network top-up credit (2026-08-26)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day extension of cross-gym booking to
membership members via a separate network top-up credit type — Carl
confirmed this working live shortly after this section was written (see
the follow-up entries that remain in `ROADMAP.md` for the PT-pack
exclusion and other live-testing findings this surfaced).

## Cross-gym booking extended to membership members: network top-up credit — 2026-08-26 (same day, later still)

The cross-gym-PAYG question above turned out to have a follow-on: Carl
asked whether membership members could get the same cross-gym access,
via a separate PAYG top-up (10% off) rather than opening their
subscription credit itself network-wide. Landed on a real
`create_booking()`/`cancel_booking()` rewrite (podHq's own ROADMAP has
the full mechanism) rather than a lighter "has this member ever bought a
top-up" eligibility gate that was considered first — Carl's own
pushback ("if there's a bug in create_booking at any time, that's
already an issue") was fair: criticality alone isn't a reason to avoid
touching a function, and he confirmed he can and will test the real flow
live himself (booking/cancelling at home and away, with and without a
top-up), which was the actual gap, not the change itself.

**Mechanism**: a PAYG top-up bought while the member has an active
membership now mints a `<type>_network` credit (e.g. `pod_network`)
instead of the base type — spendable at any gym; a top-up bought with no
active membership keeps minting the base type unchanged (no gym
restriction to unlock for those members, same as already shipped).
`checkout/route.ts`'s webhook insert points now resolve this via a new
`resolvePurchaseCreditType()` — membership renewals (`reason:
'membership'`) are untouched, always base-type, always home-gym-only.
Added a 10% checkout discount for members with an active membership
buying a credit pack (doesn't stack with the existing 20% Founding
Member discount — that one wins if both apply; an explicit promo code
still overrides either).

**Removed, now redundant**: the blanket "resource must belong to
member's own gym unless PAYG" checks in `/api/bookings` and
`/api/waitlist` from the same-day change above — `create_booking()`
itself now makes the correct type-aware decision, and the old flat check
would have wrongly blocked a membership member who *does* hold network
credit. Waitlist joining dropped the check entirely rather than
duplicating the credit logic — joining doesn't spend anything, the real
gate is `create_booking()` at accept time.

**Credit-balance display made honest**: `/book`'s per-resource number
and the Home page's headline number both had to stop assuming a single
balance. Home page now shows `getTotalCreditBalance()` (base + network
summed) as a general "you have N credits" figure; `/book` shows the
*actually spendable* number for the gym currently being viewed — total
at home, network-only away for a membership member — so a member with
no network credit sees "0" at another gym and understands why, rather
than a misleading total that includes credit they can't use there.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean in both repos. **Not yet tested live** at the
time this was written — same session, tested live and confirmed working
shortly after (see `ROADMAP.md`'s PT-pack-exclusion entry, prompted
directly by that live test).
