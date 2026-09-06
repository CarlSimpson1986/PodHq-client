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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-61.md`, covering the pilot
mechanism proof (2026-08-05) through the manual workout log (2026-09-04)
— all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. Archives aren't always the strictly oldest material —
the split point is "what's finished and stable" as much as "what's
oldest" (see each archive's own header note for examples).
Reference-only, not auto-loaded by CLAUDE.md; check them for full build
history, or `git log` on this file for exact split points. Active
content here starts at "Standalone Stripe for owned gyms" (2026-09-04).
If this file grows too large again, split it the same way: move the
most clearly finished section into `ROADMAP-ARCHIVE-62.md`, update this
paragraph.

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

## Exercise catalog extended for Carl's own technique videos — 2026-09-06

Carl filmed ~75 of his own exercise-technique clips and uploaded them
all through podHq's `/exercise-videos` admin page (full upload-side
detail, including a real browser-automation limitation and its fix, is
in podHq's own ROADMAP_HISTORY.md, stage 60). This is the client-side
catalog/content work that upload needed.

**22 new exercises added to `exercise-catalog.ts`.** 5 promoted from
clips that would otherwise have lost a slot to a collision on an
existing key (`plank_elbow`, `side_plank`, `cable_lateral_raise_standing`,
`kettlebell_single_arm_swing`, `cable_rope_pushdown`), plus 15 new ones
across chest/back/legs/arms/core, plus `hanging_knee_raise`/
`hanging_leg_raise`. Every one carries a **draft** `safetyTip` flagged
in-code for Carl to review before it's treated as final — this file's
own convention is that injury-risk copy is human-written, never
LLM-generated, and that matters more than usual here since these pods
are unmanned with no staff backstop.

**`pull_up_bar` added as a new `EquipmentType`** (duplicated in podHq's
`src/lib/data/types.ts` + its `/pods` calendar equipment checkboxes, per
the existing cross-repo convention) — Carl confirmed Hove actually has
one before this was added. Still open: confirm Hove's
`pod_resources.equipment` row actually has it checked in `/pods`, or
the two hanging exercises will never actually get prescribed despite
the code supporting them now.

**Warm-up/cool-down gained video support it never had.**
`warmup-cooldown.ts`'s `WarmupCooldownItem` had no `key` field at all —
added one to every item (old and new), and `workout-view.tsx`'s
warm-up/cool-down checklist now shows a video under any row with one,
the same `exerciseVideoOverrides[key]` lookup the main exercise view
already used. 7 new stretch/mobility items added alongside the 4
pre-existing ones (cat-cow, hamstring sweep, calf/glute/hip-flexor/lat
stretch, pigeon pose) — their instructions are drafts too, same
review caveat as the safetyTips above.

**Premium/AI-Coach waiver clause added to Clause 18 (WAIVER)**, in both
`waiver-terms.ts` (the real member-facing waiver at `/access/waiver`,
first-person voice) and `terms-and-conditions.ts` (the chatbot's
second-person reference transcription of the same document): technique
videos and AI-selected/generated workouts are general guidance only,
not personalised medical/professional advice, and the member is solely
responsible for judging whether an exercise/weight/equipment item suits
them. Not legally reviewed — wording matched to each document's
existing voice, not drafted independently; if Carl maintains a separate
master PDF as the actual source of truth, it needs the same addition
there too.

Verified via podHq's own `/api/exercise-videos` endpoint after each
upload batch (override count/keys checked against what should have
just landed — 75 at the end, folder confirmed empty of anything left
unmatched).

**`npx vitest run` caught a real bug before it shipped**: "softly
prefers compound lifts during a strength block" failed after the
catalog additions — `selectExercises()`'s Strength-block compound
preference is a flat array-order slice, not muscle-group-aware, so
marking `lat_pulldown_v_grip`/`lat_pulldown_double_handle` (grip
variants of the pattern `lat_pulldown` already covers) as
`isCompound: true` let a generated session end up with three
lat-pulldown variants and no chest/shoulder exercise. Fixed by setting
those two, plus `kettlebell_single_arm_swing` (same reasoning — same
hip-hinge pattern as the two kettlebell swings already marked
compound), to `isCompound: false`. Full suite clean after: `tsc
--noEmit`, eslint, `npx vitest run` (178/178) in this repo; `tsc`,
eslint, `npx vitest run` (9/9) in podHq.

## Workout flow design pass + a real progression bug found — 2026-09-06

Same session, continued: Carl clicked through the newly-filled exercise
library live and drove a full redesign pass on the workout screens,
plus asked for a proper competitor-informed feature. All verified live
against the dev server with a seeded test member (Hove, credits/bookings
granted via one-off scripts, matching this project's established
throwaway-script convention).

**Overview redesigned into three collapsible sections** — Warm-up /
Main workout / Static stretching, replacing the old flat exercise list
plus two separate "Add a warm-up"/"Add a cool-down" checkboxes. Main
workout starts expanded, the other two collapsed with a one-line
summary. The checkboxes were removed entirely in a follow-up round —
both sections are now always part of the flow by default, and a member
opts out live via a "Skip warm-up"/"Skip to stretching" link instead of
pre-deciding on the overview screen. `skipMainWorkout()` added so a
member can also bail out of the main workout early and jump straight to
stretching (previously only reachable by finishing every set).

**"← Exit" replaced with "← Home"** plus `ArrowLeftIcon` (already
defined in `icons.tsx` for exactly this "leave this nav" case, but
unused until now) — Carl: the plain underlined text was easy to miss as
the way back out of the workout flow entirely.

**Core exercises now always sort to the end** of the main workout
(Carl: "core should be the end") — a stable partition applied in both
`generateWorkout()` and `instantiateTemplate()` (the template-based path
is what most sessions actually take, once there's an active block), so
whichever muscle-group rotation ran, any `core`-tagged pick moves after
everything else while keeping its own relative order. Deliberately
left "Build your own" (manual/AMRAP/RFT/HIIT picks) untouched — that's
the member's own explicit order, not an AI-generated one.

**Warm-up/cool-down redesigned to step through one item at a time**,
matching the main workout's own flow, instead of showing the full
checklist at once (Carl: "yes" once he understood why it had been a
checklist — no reps/weight to log per item, so a flat list was the
original reasoning, but a step-through reads clearer). `warmupItemIndex`/
`cooldownItemIndex` replace the old shared `checkedIndices` set, reset
to 0 on entering each phase.

**"Why did this change?" explainability shipped**, prompted by a
ChatGPT Deep Research pass on competitor complaints (Fitbod/Future/
Zing/JSA — full findings not reproduced here, ask Carl for the
document) that named "forgotten previous weight/no visible reasoning"
as the single most-repeated failure across the category. Every working
set's weight target now shows a plain-English "Why:" line — held/
increased/reduced against last time's real RPE, or a deload-week note —
computed by a new `describeWeightChangeReason()` that's a pure readout
of the exact rule `adjustForRpe` already runs, never a separately
invented explanation. New `workout_exercises.weight_change_reason`
column (`0088_workout_exercise_weight_reason.sql`, podHq), threaded
through `generateWorkout`, `instantiateTemplate`, and the exercise-swap
flow so it stays correct after a member swaps an exercise mid-session
too.

**Found and fixed a real pre-existing bug while building the above**:
`getWorkoutHistory()` read `weight_target_kg` (the *suggested* number)
instead of `weight_actual_kg` (what the member actually lifted) when
building progression history. A first-time exercise's target is null by
design (see generate-workout.ts's own comment on why), so this silently
zeroed out `lastWeightKg` the very next time that exercise came up —
exactly the "previous weight forgotten" complaint the research named,
caught live via the exercise-swap flow producing "Held the same as
nullkg last time" before the fix. Also skips any completed set with a
null `weight_actual_kg` (a duration-based hold, or an anomaly) rather
than recording a bogus zero, so an older real-weight completion wins
instead of being shadowed.

Also fixed along the way: the workout page's `PageHero` dropped its
"Your AI Coach" subtitle (Carl: not needed) — `subtitle` is now optional
on `PageHero` itself, not just blanked for this one caller.

**Verified live throughout** via a seeded dev-only test member (not a
real customer) — booked/re-booked sessions, swapped an exercise into
one with real prior history to force a non-null "Why:" line, confirmed
the DB write directly after each change rather than trusting the UI
alone. `tsc --noEmit`, eslint, and `npx vitest run` (178/178) clean
after every round; `npm run build` clean at the end. Migration
`0088` applied live by Carl via Supabase's SQL Editor before the
exercise-swap verification pass, same manual-application pattern as
every other migration this project uses.
