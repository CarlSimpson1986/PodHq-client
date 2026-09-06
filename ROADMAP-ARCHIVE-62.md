# Archive 62 — Standalone Stripe for owned gyms, Hove (2026-09-04)

Split out of `ROADMAP.md` 2026-09-06 to stay under the ~15,000-character
import limit — this section was fully finished and verified live against
the real Stripe account. See `ROADMAP.md`'s own header for the full
archive-splitting convention.

## Standalone Stripe for owned gyms (Hove) — 2026-09-04

Hove and Aylesbury Berryfields are Carl's own gyms, not franchisees —
found mid-session that the existing Stripe Connect work (per-gym
onboarding, own balance/payouts for a third party) is the wrong model
for them, and Hove's existing Connect setup was test-mode only, never
real. podHq's side (0084, encrypted `api_key_encrypted`/
`webhook_secret_encrypted` on `gym_stripe_config`, admin `/setup` panel)
built first — full detail in its own ROADMAP.md. This is the client-side
half: actually using a standalone gym's own key.

`src/lib/data/stripe-config.ts` gained `getGymStripeContext(gym)` —
resolves, in order: (1) standalone key → that gym's own `Stripe` client
directly, no `stripeAccount` header; (2) completed Connect onboarding →
platform client + `stripeAccount` option; (3) neither → shared platform
account, unchanged from before either mechanism existed. Every route
creating or reading a Stripe object for a gym (`checkout`,
`checkout-membership`, `checkout-voucher`) now goes through this instead
of the old Connect-only `getGymStripeAccountId`. Also fixed a real
pre-existing gap found while touching this: `membership/cancel` never
routed to any per-gym account at all — always the shared platform
client, which would have failed for any gym with its own account.

**Webhook route rewritten** to try three signing-secret sources in
order — platform, platform's Connect-scope, then each configured
standalone gym's own secret in turn — and, critically, remembers *which*
matched so every follow-up Stripe call in that request (retrieving a
PaymentIntent, a Subscription, listing Invoice Payments, updating a
Customer) uses the right client. A standalone gym's events never carry
`event.account` (they're not Connect events), so the client swap has to
happen explicitly rather than falling out of the existing
`connectRequestOptions` logic. Two internal re-declarations of `stripe`
that had been silently shadowing the outer client (inside the
`invoice.payment_succeeded` handler and `saveStripeCustomerId`) were
also fixed — the second now takes the resolved client as an explicit
parameter instead of creating its own.

**Verified against the real live account, not test data.** Decrypted
Hove's saved key/secret server-side and confirmed both independently:
`stripe.accounts.retrieve()` authenticated as "My Fit Pod Hove"
(`acct_1U5oYF8t3RuWgRkp`), key confirmed `sk_live_`. Then the real HTTP
path: logged into local dev as Carl's own Hove account, clicked Buy on
a live £1 test catalog item, and the browser landed on
`checkout.stripe.com/f/pay/cs_live_...` branded "My Fit Pod Hove" with
the correct item/price — proving checkout → `getGymStripeContext` →
Hove's key → Stripe's hosted page resolves correctly end to end.
Session abandoned before entering payment details — creating a Checkout
Session costs nothing until it's actually paid, so this confirmed
routing without moving real money. `tsc --noEmit`, eslint, `npx vitest
run` (178/178), and `npm run build` all clean.

Not yet done: podHq's own admin-side Stripe touch points (staff
refund route, sell/comp panel with card-on-file) still only know about
the Connect case, not standalone — flagged, not yet needed for Hove's
first real purchases but will matter once staff need to refund or
manually sell to a Hove member.
