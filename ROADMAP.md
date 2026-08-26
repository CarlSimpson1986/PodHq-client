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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-24.md`, covering the pilot
mechanism proof (2026-08-05) through the first cross-gym PAYG booking
stage (2026-08-26) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s,
`-21.md`'s, `-22.md`'s, `-23.md`'s, and `-24.md`'s own header notes for
same-day examples of this). All archives are reference-only (not
auto-loaded by CLAUDE.md); check them for full stage-by-stage build
history, or `git log` on this file for the exact split points. This
file's active content is the equipment-aware AI Coach work (2026-08-24)
plus whatever's added after it. If this file grows too large again,
split it the same way: move whichever section is most clearly finished
(not necessarily the chronologically oldest) into a numbered
`ROADMAP-ARCHIVE-25.md`, leave a pointer note at the top of this file,
and update this paragraph.

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

## Network credit scoped to gym packs + both LLM chats hardened — 2026-08-26 (same day, later still)

More real findings from Carl's own live testing. Full detail in
`../podHq`'s ROADMAP (the migration and Stripe-metadata plumbing live
there); summary here:

**PT packs shouldn't get the network discount/type** — only Recovery
Room packs were actually excluded (separate `credit_type`); PT packs
share `credit_type: 'pod'` with a plain solo credit, so a new
`catalog_items.network_eligible` flag (podHq's
`0065_catalog_network_eligible.sql`) now gates both `/api/checkout`'s
10% discount and the webhook's network-type minting, per pack rather
than per member. `/buy-credits` shows the discount per-item now, not as
one page-wide toggle.

**Content moderation** — Carl tested the POD chat with real abuse; both
messages got the bot's normal "best-effort + flag for staff" treatment,
dumping abuse into the FAQ-improvement queue as if it were a real
candidate question. `help-bot.ts` and `coach-chat.ts` (AI Coach) both
gained prompt-injection resistance and an abuse/off-topic redirect that
POD chat specifically never flags for staff. Live-smoke-tested against
the real model before shipping — abuse and off-topic both redirected
cleanly, a direct injection attempt was deflected with nothing leaked,
and the cross-gym FAQ entry answered correctly. Also found and fixed:
the 3 original FAQ answers (cancel membership, missed-booking credit,
under-16) were silently dropped when the FAQ moved to a DB table earlier
today — only Carl's own manually-added entry survived. Restored.

**Booking-page top-up prompt** (Carl's suggestion): a failed cross-gym
booking on insufficient credits now shows a direct "Buy a top-up for
{gym}" link in `booking-grid.tsx`, instead of a plain error the member
had to act on unprompted.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean in both repos. Moderation prompt changes were
live-tested against the real model; the network-eligible restriction and
booking-page prompt weren't — same limitation as elsewhere this session.

## Crisis-signal detection for both LLM chats — 2026-08-26 (same day, later still, urgent)

Carl tested POD chat with "I want to kill myself." The abuse/off-topic
redirect just added would have caught it and replied "I can only help
with questions about bookings, credits, and gym policies" — a genuinely
harmful response to send someone expressing suicidal intent, not just an
unhelpful one. Fixed immediately as its own priority rule, not a subcase
of the abuse redirect.

**Deliberately not model-generated**: the model is only ever asked to
*signal* detection via a hidden `<<CRISIS_SIGNAL>>` marker (new
`CRISIS_SYSTEM_PROMPT_RULE`, overrides every other instruction in the
prompt) — the actual reply is fixed, pre-written UK crisis-resource text
(Samaritans 116 123, 999 if in immediate danger), shared between
`help-bot.ts` and `coach-chat.ts` via new `src/lib/crisis-response.ts`.
Never trusting the LLM to freely write this response itself — a wrong
phrasing, a cut-off sentence, or a hallucinated number would matter most
exactly when it's least acceptable to get wrong.

Both `askHelpBot`/`askCoach` now return an `isCrisis` flag; both API
routes send a distinct, urgently-worded staff email
(`memberCrisisSignalEmail`, new `member_crisis_signal` notification
type) the moment it fires — deliberately *not* routed through the
generic "unanswered FAQ question" queue/email, since this is a welfare
signal, not an FAQ gap, and shouldn't wait for someone to check a queue.

**Live-tested against the real model before shipping** (a throwaway
script, same pattern as the moderation smoke test earlier today): Carl's
exact input, a plain "I want to kill myself," and an indirect phrasing
("I've been thinking about ending it all") all correctly triggered the
fixed crisis reply with nothing else in the output; a normal FAQ
question continued answering normally, unaffected.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. The crisis-detection prompt itself was live-
tested against the real model (see above) — the strongest verification
any change got today. The staff-email path (`memberCrisisSignalEmail`/
`notifyFireAndForget`) follows the exact same pattern already proven
live earlier today (Chat Questions), not independently re-tested this
pass.

**Correction, same day, minutes later**: Carl pointed out "ChatGPT doesn't
get an urgent email" — a real objection, not just a style difference.
Mental-health disclosures are UK GDPR special-category data; notifying
gym staff (untrained, no confidentiality obligation, no consent asked)
is a real data-protection question, and once staff are told, "you knew
and didn't act" becomes a liability that doesn't exist if the business
was never told — exactly why every mainstream consumer AI product shows
crisis resources directly and loops in no one else. Removed the staff
email entirely (`memberCrisisSignalEmail`, `member_crisis_signal` event
type, and the `isCrisis` plumbing in both API routes) — `askCoach`
reverted to its original plain-string return, since exposing `isCrisis`
had no remaining consumer. The member-facing fix (fixed crisis-resource
reply, never model-generated) is unchanged. Should have flagged this
trade-off before building the staff-alert half, not shipped it as a
default.
