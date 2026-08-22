# PodHQ Client — Build History (Archive 3)

Reference-only, not `@`-included by CLAUDE.md — read on demand. Continues
from `ROADMAP-ARCHIVE-2.md` (2026-08-16 OWASP audit through 2026-08-19's
Wellness/Recovery Room slot-duration fix). This file covers the Stripe
Connect Hove pilot (2026-08-19), split out of `ROADMAP.md` on 2026-08-22
once that file exceeded Claude Code's ~15,000-character `@`-import limit.
`ROADMAP.md` picks up from the guided-tour/FAQ "POD" work (2026-08-21)
onward and is the active, auto-loaded log going forward.

If this file (or the next active `ROADMAP.md`) grows too large again,
split it the same way into a numbered `ROADMAP-ARCHIVE-4.md`, leave a
pointer note at the top of `ROADMAP.md`, and update that note plus
CLAUDE.md's session-handoff guidance to match.

## Stripe Connect — Hove pilot (per-gym payment separation) — 2026-08-19

Built at the user's request: today every gym shares one Stripe account —
Stripe itself has no concept of "which gym" a payment belongs to, only
reconstructed after the fact from `member.gym`. The user wants real
per-gym separation (own balance, own payouts, franchisees able to refund
their own clients directly), via **Stripe Connect**, piloted on **Hove**
first since it isn't open yet.

Confirmed with the user before building: Hove has no existing Stripe
account, so this uses **Connect Onboarding** (create a brand-new Standard
account) rather than OAuth-linking an existing one; connecting a gym is
**admin-only** in podHq's `/setup`, same pattern as the existing Resend/
Brevo cards; **direct charges** — the Checkout Session is created against
the gym's own connected account, so money and Stripe's fee land there
directly; and **franchisees must be able to refund their own clients from
podHq** — the one hard requirement. `podHq/src/app/api/pods/refund/
route.ts` already scoped an `owner` correctly to their own gym; the only
real gap was `stripe.refunds.create()` always hitting the platform
account regardless.

`podHq/supabase/migrations/0040_gym_stripe_config.sql` (written and
**applied 2026-08-19** — per the shared-schema rule, flagged in both
repos' ROADMAP.md) — `gym_stripe_config`: `gym` (unique), `stripe_account_id`
(not a secret, unlike the Resend/Brevo keys — no encryption needed),
`onboarding_complete`. A gym with no row (every gym today) falls back to
the shared platform account exactly as before — not a breaking change for
anyone but Hove.

**podHq (owns account creation + admin UI)**: `src/lib/data/stripe-
connect-config.ts` — `startStripeConnectOnboarding` creates the Standard
account + a fresh Account Link, `completeStripeConnectReturn` re-checks
`details_submitted` against the real Stripe object rather than trusting
the redirect alone (same "don't trust the redirect, check real state"
reasoning this app's own Stripe Checkout `success_url` already
established), `getStripeAccountId` is the read used by the refund route.
New `POST/GET /api/setup/stripe-connect` (admin-only, same
`getGymScope`/rate-limit pattern as `/api/setup/resend`) and its
`/return` callback. New `StripeConnectView` card in `/setup`'s
`SetupShell`, next to Resend/Brevo.

**podHq refunds**: `/api/pods/refund/route.ts` now looks up the paying
gym's `stripe_account_id` and passes `{ stripeAccount }` into
`stripe.refunds.create()` when present — no role/scoping change needed,
the existing owner-locked-to-own-gym check already did the right thing,
this only fixes *which* Stripe account the call hits.

**This app (podhq-client)**: new `src/lib/data/stripe-config.ts` —
cross-app read of `gym_stripe_config`, same pattern as `resend-config.ts`.
`/api/checkout`, `/api/checkout-membership` (including the tier-switch
subscription cancel), and `/api/checkout-voucher` all look up the
member's gym and pass `{ stripeAccount }` into their
`checkout.sessions.create()` call when the gym has a connected account.
`/api/webhooks/stripe/route.ts` captures `event.account` (present only
for connected-account-originated events) and threads it through every
*secondary* Stripe API call the handler makes —
`paymentIntents.retrieve`, `subscriptions.retrieve`,
`invoicePayments.list`, `customers.update` — since resolving which
member/gym a payment belongs to already works via metadata regardless of
account, but those follow-up calls 404 against the wrong account without
it.

**Real bug caught by `tsc` before it shipped**: the Stripe Node SDK takes
connected-account routing as a distinct `options` argument, not folded
into `params` — `stripe.paymentIntents.retrieve(id, options)` silently
type-checks (extra properties on a typed variable aren't flagged the way
literals are) but the option is ignored at runtime. Fixed by passing
`undefined` for `params` explicitly and `options` as the third argument
throughout.

**Flagged, not built this pass**: podHq's staff "charge card on file"
sell panel stays platform-account only — a saved card lives on the
platform account's Customer object today, and charging it against a
connected account instead is a separate, larger change (Customer/payment
methods don't automatically carry over between Stripe accounts). Every
gym besides Hove stays on the shared platform account until it's
individually connected — this pass only builds the pipe, not a rollout to
every gym.

**Not yet live-tested — two of three manual steps outstanding before it
can be**: (1) migration applied ✓, (2) Connect enabled on the Stripe
platform account (Standard accounts, direct funds flow, Stripe-hosted
onboarding + Stripe Dashboard for account management) ✓; (3) **podHq's
own `STRIPE_SECRET_KEY` is a deliberately restricted key (`Charges: read,
Refunds: write` only, per its own `stripe.ts`) — creating connected
accounts needs the `Connect` write permission added to that same
restricted key**, or the onboarding calls will fail. Once deployed, a
fourth step: toggle "Listen to events on connected accounts" on the
existing webhook endpoint so it also receives events from Hove's account
(same signing secret, no new webhook secret needed). `npx tsc --noEmit`,
`eslint`, and `next build` all pass clean in both repos.

(Note: podHq's own ROADMAP.md Stage 29 later records this as verified
live end-to-end 2026-08-20 — that follow-up verification was never
back-filled into this file before the 2026-08-22 split. Check podHq's
ROADMAP_HISTORY.md for the live-test detail if needed.)
