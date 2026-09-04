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

**Older history has been split into numbered archive files** —
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-60.md`, covering the pilot
mechanism proof (2026-08-05) through the Premium onboarding overhaul
(2026-09-03) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Icon color revert; real Coach-tour bug
found live" (2026-09-03). If this file grows too large again, split it
the same way: move the most clearly finished section into
`ROADMAP-ARCHIVE-61.md`, update this paragraph.

## Icon color revert; real Coach-tour bug found live; tour extended to Training/Nutrition — 2026-09-03

Same-day follow-up once Carl actually clicked through the above.

**Icons reverted**: the white-bg/black-icon treatment from the entry
above didn't survive contact — Carl: "I WANT THE ICONS BACK TO THE
ORIGINAL COLOUR." Both `pod-assist-mark.png`/`pod-coach-mark.png` are
white line art again (deleted the black-recolored variants entirely),
and the label pills underneath now read "POD ASSIST"/"POD COACH" in
full on white-background/black-text (was gold/black inconsistently
before) — the one piece of the white/black direction that stuck.

**The Coach tour's "Show me around" chip was genuinely invisible, not
just stale-cached** — worth recording precisely, since it looked
identical to this session's other caching false-alarms at first. Ruled
caching out for real this time (Incognito window, zero cached state,
still missing), then instrumented `coach-chat-view.tsx` with a
temporary on-page debug readout rather than keep guessing — it showed
`onReplayTour=true`, `isWelcomeOnly=true`, everything correct. Root
cause: the button's className used `text-foreground`/`border-card-border`
(dark-theme tokens, meant for the black page) inside Pod Coach's white
`card-light` chat panel — white text on white, present in the DOM the
whole render, just invisible. Fixed to the same light-context tokens
(`text-card-light-foreground`/`border-card-light-border`) Pod Assist's
own equivalent button in `help-chat-view.tsx` already used correctly —
a straight copy-paste would have avoided this. Debug code removed after
confirming the fix.

**Coach tour extended from Dashboard-only to a real cross-page tour** —
Carl, mid-walkthrough: "this is not it — you havent gone through the
training system or the nutrition." Same architecture as Pod Assist's
own cross-page tour (`tour-runner.tsx`/`tour-continuation.tsx`/
`tour-state.ts`), mirrored: `coach-tour-state.ts` (separate sessionStorage
key, `podCoachTourResumeIndex`), `coach-tour-continuation.tsx` (mounted
on `/training` and `/nutrition`, passive), `coach-tour-runner.tsx`
rebuilt to hand off between pages via `onDoneClick` (with the explicit
`driverRef.current?.destroy()` calls the Pod Assist debugging session
upstream already proved necessary, baked in from the start this time).
New sequence, 12 steps: Dashboard (week strip, recovery, sessions,
nutrition summary, recommendation, leaderboard) → Training (next
session, training block, consistency) → Nutrition (daily targets, log a
meal, done). Real anchors added on both pages
(`#tour-coach-training-next/-block/-consistency`,
`#tour-coach-nutrition-summary/-log`) — the nutrition summary anchor
needed its own inner wrapper div rather than reusing the outer
`card-light` container, which also held the meal log and would have
made the two steps' spotlights visually identical.

Also removed the "Your habit streak" Dashboard step (Carl: redundant —
the same Main Effort card already shows on Home) and the `#tour-coach-habit`
id it targeted.

**Verified**: `tsc --noEmit` clean throughout. The invisible-button root
cause was confirmed via live instrumentation, not guessed — the debug
readout's values were screenshotted before the fix. Dashboard's 6 steps
re-verified live via direct DOM inspection (correct order, glow on
every step); Training/Nutrition's cross-page hand-off itself hit the
same automation-tab `requestAnimationFrame` limitation again when
re-tested this way, but the resume pointer and page navigation were
confirmed correct, and Carl's own real-tab click-through afterward
("ok that will do!") confirms the full sequence actually works live.

## More meal suggestion variety — 2026-09-03

Carl: "I would like to add more options for what to eat next" →
"I want as much variety as possible." `meal-suggestions.ts`'s
`SUGGESTION_COUNT` (2 → 4, one idea per open meal slot on a day with
nothing logged yet, not always just two) and its top-up pass (was a
couple of fixed calls that could silently return fewer than asked for —
now loops until it actually reaches the count or the catalog's
exhausted). `meal-catalog.ts` doubled, 24 → 48 hand-written meals (12
per slot) — more proteins (pork, beef, prawns, halloumi), cuisines
(curry, fajitas, shakshuka), and vegetarian options, same
reviewed-not-runtime-LLM-generated convention as the rest of the file.
`tsc --noEmit` clean; not yet checked live.

## Manual "worked out anyway" workout log — 2026-09-04

Continuation of the 2026-09-03 session, which drafted and applied
`member_workout_manual_logs` (podHq's `0083`, shared DB) but left the
migration file uncommitted in podHq and never built this side. Picked
back up 2026-09-04: `src/lib/coach/workout-manual-log.ts` (get/log/undo,
same insert-only + same-day-only-delete convention as `habit_logs`),
`/api/member/workout-manual-log` (POST/DELETE, same session/rate-limit/
member-lookup shape as every other member route), and
`todays-mission.ts`'s `no_booking` workout state extended with a
`manuallyLogged` flag.

`todays-mission-card.tsx`'s Workout row (no-booking case) changed from
a single `Link` wrapping the whole row to a tickable `StatusDot` button
(same look/behaviour as `DailyHabitsCard`'s tick/untick) plus a separate
`/training` preview `Link`, so ticking and previewing don't fight over
the same tap target.

**Verified live**: `tsc --noEmit`, eslint, and `npx vitest run`
(178/178) all clean. Logged into local dev as Carl's own real
trial-active Hove account — ticked the Workout dot (POST 200, dot went
green, text → "Logged today — preview →"), reloaded the page fresh to
confirm the server-rendered state persisted (0/4 → 1/4 today), then
undid it (DELETE 200) and reloaded again to confirm it reverted to
0/4. Full round trip confirmed against the real DB, not just optimistic
client state.

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
