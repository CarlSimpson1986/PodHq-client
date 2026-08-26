# ROADMAP Archive 26 — Network-credit follow-ups from live testing (2026-08-26)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day fixes found from Carl's own live
testing of the network-credit work: `/buy-credits` explaining nothing
about the subscriber discount, and checkout ignoring which gym was
actually being bought for.

## Network-credit follow-ups from live testing: /buy-credits messaging + gym-aware checkout — 2026-08-26 (same day, later still)

Carl set up a real test membership and tried the flow live (a scratch
membership row + cleared credits, inserted directly via a one-off admin
script for member id 123 — same pattern as podHq's existing
`create-pilot-member.mjs`-style scripts, not something this repo's own
code does). Two real gaps found:

**`/buy-credits` explained nothing**: the 10% subscriber discount only
appeared once Stripe's checkout page loaded, and nothing on the page
told a member that credit bought now works at any gym. Now shows the
discounted price directly (original struck through) plus a short note,
skipped for a founding member (their 20% already wins at checkout, so
this shouldn't be previewed).

**Bigger one — checkout ignored which gym you were actually buying
for**: `/api/checkout` always priced from and paid out to `member.gym`,
with zero awareness of the gym being browsed on `/book`. Buying credit
while looking at Hove still priced and paid Aylesbury. Fixed by
threading a `?gym=` param end to end: `/book`'s "Buy more" link → `/buy-
credits` (prices from that gym's catalog, page title/subtitle say which
gym) → `/api/checkout` (resolves and validates the gym, uses it for both
`getCreditPackageById`/`findApplicablePromoCode` and — the actual point
of the fix — `getGymStripeAccountId`, so the money lands with the gym
actually being bought for) → success/cancel URLs carry the same gym back
through so a member isn't dropped back on their home gym's `/book` after
paying for a different one. A plain link to `/buy-credits` with no
param behaves exactly as before this change (falls back to `member.gym`
throughout).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Not yet re-tested live after this specific fix —
found via Carl's own live testing of the network-credit work above, not
yet re-verified by him.
