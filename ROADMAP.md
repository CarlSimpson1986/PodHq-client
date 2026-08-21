# PodHQ Client — Pod Booking & Kisi Unlock

Staged build order, same philosophy as `../podHq`'s ROADMAP.md: guide the
user through each stage step by step, ask before proceeding on anything
that could go multiple ways, confirm each stage works before moving to the
next. Don't jump ahead to a later stage unprompted.

Sibling project to `../podHq` (the admin/owner analytics app) — this is the
member-facing PWA: book a pod session, unlock the door via Kisi. Reuses
podHq's Supabase project (same `SUPABASE_URL`/keys) and its dark/gold
Tailwind theme, but is a fully separate Next.js app with its own repo and
deploy. Started as an Aylesbury Berryfields-only pilot (decided
2026-08-06); ended that scope 2026-08-16 with the multi-gym signup
dropdown — see the archive below for the pilot-era stage detail.

**Stages 1-9 (pilot mechanism proof through gift vouchers, 2026-08-05 →
2026-08-15) have been moved to `ROADMAP-ARCHIVE.md`**, and **2026-08-16
(OWASP audit) through 2026-08-19 (the Wellness/Recovery Room slot-duration
fix) have been moved to `ROADMAP-ARCHIVE-2.md`** — both split out to keep
this file within Claude Code's ~15,000-character `@`-import limit (this
file had grown to 60KB before the second split, 2026-08-21). Both archives
are reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history. This file picks up from the Stripe Connect
Hove pilot (2026-08-19) and is the active, auto-loaded log going forward.
If this file grows too large again, split it the same way into a numbered
`ROADMAP-ARCHIVE-3.md`, leave a pointer note at the top of this file, and
update this paragraph plus `CLAUDE.md`'s session-handoff guidance to
match.

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

## Guided first-login tour ("POD"), phase 1 — 2026-08-21

First piece of the "POD" onboarding/FAQ assistant idea
(see podHq's memory notes — nothing previously built). Scoped down after
discussion with the user: build the scripted guided-tour half now, ahead
of Hove's launch, and defer the FAQ-bot half — a full RAG/tool-calling
agent isn't clearly needed yet for a single small gym, and a cheaper
static-FAQ version should ship first if/when real usage shows people
need it, rather than building the fancier version speculatively.

**Library: `driver.js`** (MIT-licensed, ~5kb, no dependencies) — chosen
over Intro.js (dual-licensed, needs a paid commercial license for a
business app) and Shepherd.js (heavier, no clear advantage here for a
mobile PWA).

**Persistence**: `members.tour_completed_at` (nullable timestamptz,
`0045_member_tour.sql` in podHq's shared migrations folder — applied and
verified live). Null means "never seen it" — auto-launches once
regardless of device, then stays off. New `POST /api/member/tour-complete`
route (session-validated, rate-limited, same pattern as every other
member-write route) marks it complete.

**v1 scope: home screen only**, deliberately not cross-page, to avoid
tour-state-across-navigation complexity for a first version: greeting →
credits available → next-session card → Book/Shop/Profile bottom-nav
icons → a persistent "?" button (`onboarding-tour.tsx`) that replays it
on demand afterward. That same "?" button is the intended future home for
the FAQ bot half of POD once that gets built — confirmed with the user
this is the same icon from the original scoping, not a new one.

**Verified live end-to-end** via a throwaway test member
(`podhq-test-tour@example.com`, gym: Aylesbury Berryfields) through the
real UI, not just the build: all 7 steps highlighted the correct element
with sensible copy; "Done" correctly wrote `tour_completed_at`; reloading
the page did **not** re-launch the tour; the "?" button correctly
replayed it manually afterward. Test account and verification scripts
deleted after. `npx tsc --noEmit`, `eslint`, and `next build` all pass
clean.

**Known minor inefficiency, not fixed**: the "?" button's `onDestroyed`
handler decides whether to call the completion API from the
`tourCompletedAt` prop captured at mount — correct across page loads, but
if a member manually replays the tour on the *same* page load where they
just completed it for the first time, it re-fires the (idempotent, harmless)
completion POST a second time. Not worth the added complexity of tracking
a separate "already marked" flag for a one-extra-request edge case.
