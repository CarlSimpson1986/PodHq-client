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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-22.md`, covering the pilot
mechanism proof (2026-08-05) through the POD chat production fixes
(2026-08-26) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s, `-15.md`'s,
`-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s, `-21.md`'s,
and `-22.md`'s own header notes for same-day examples of this). All
archives are reference-only (not auto-loaded by CLAUDE.md); check them
for full stage-by-stage build history, or `git log` on this file for the
exact split points. This file's active content is the equipment-aware AI
Coach work (2026-08-24) plus whatever's added after it. If this file
grows too large again, split it the same way: move whichever section is
most clearly finished (not necessarily the chronologically oldest) into
a numbered `ROADMAP-ARCHIVE-23.md`, leave a pointer note at the top of
this file, and update this paragraph.

## Equipment-aware AI Coach workout generation — 2026-08-24

Shipped and verified — full detail moved to `ROADMAP-ARCHIVE-14.md` the
same day, to make room for the still-active wearable-integration research
above. Summary: `pod_resources` gained an `equipment` column (empty =
unrestricted, today's exact behavior); `generateWorkout`/`swapExercise`
now filter/re-validate against a resource's configured equipment; podHq's
pod Settings panel gained equipment checkboxes. **Still outstanding**: no
gym's equipment has actually been set yet (including Hove's already-
confirmed real equipment) — every gym runs unrestricted until Carl works
through the Settings panel gym by gym.

## Continuous-improvement loop for POD chat: FAQ moved to a DB, unanswered questions logged — 2026-08-26 (same day, later)

Carl asked how to stop the help chat ("POD") dead-ending members with "not
sure, ask staff" and nothing captured anywhere — framed as "how big
companies do continuous improvement." Landed on: the FAQ moves off the
static `src/lib/faq.ts` array into a DB table admin can edit live
(`help_faq_items`, no redeploy needed), and every question the bot
couldn't answer gets logged + emailed to gym staff immediately, reviewable
in a new `/chat-questions` page in `../podHq` (full detail there).

**Detection**: `help-bot.ts`'s system prompt now tells the model to end
an unanswerable reply with a hidden `<<STAFF_FOLLOWUP>>` marker (never
shown to the member) rather than asking for structured JSON output, which
the Groq/Anthropic calls here aren't set up for. `askHelpBot` now returns
`{ reply, needsStaff }`; `help-chat/route.ts` strips the marker, and on
`needsStaff` awaits (not fire-and-forget) a log insert
(`src/lib/data/help-chat-questions.ts`) plus a staff email — reusing
`getStaffRecipients`/`notifyFireAndForget`, the same infrastructure
`staff_new_signup` etc. already use, just a new `unanswered_chat_question`
event type and template, not a second notification path.

**FAQ off the code file**: `src/lib/data/help-faq.ts` (new) reads
`help_faq_items` via the service-role client; `src/lib/faq.ts` deleted.
The chat's own quick-question chips (added earlier this session) now
fetch from a new `/api/member/help-faq` route instead of a static import,
since `help-chat-view.tsx` is a client component and can't read the
server-only data layer directly.

**Shared-schema change, flagged in both apps**: new migration
`0063_help_faq_and_chat_questions.sql` lives in `../podHq`'s
`supabase/migrations/` per this file's own convention — **written this
session, not yet applied**. Carl runs migrations himself via the Supabase
SQL Editor; a Claude session has no DB DDL access, so this doesn't work
at all until he does. `../podHq`'s own ROADMAP has the full write-up of
the new `/chat-questions` admin page (review queue + FAQ CRUD).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. **Confirmed live**: migration applied by Carl via
the Supabase SQL Editor, then genuinely exercised the same session — a
member question the bot couldn't answer confidently (cross-gym
membership use, see below) correctly triggered the `<<STAFF_FOLLOWUP>>`
marker, landed in podHq's Chat Questions queue, and the staff email
arrived — the full loop working end to end, not just a clean build.

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
`next build` all clean in both repos. **Not yet tested live** — same
limitation as above; this is the higher-stakes surface of the two
(directly rewrites the credit-deduction/refund logic every booking goes
through), so a real live pass — book home, book away with a top-up, book
away *without* one and confirm rejection, cancel each and check the
refund lands in the right type — matters more here than anywhere else
shipped this session.

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
