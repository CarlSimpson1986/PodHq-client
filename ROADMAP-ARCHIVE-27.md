# PodHQ Client — Archive 27

Split out of `ROADMAP.md` on 2026-08-27 to make room for that day's PubMed
citation-hit-rate work, once the live file passed its ~15,000-character
budget again. These three sections were the most clearly finished/stable
at the time of the split (not the strictly oldest still-active content) —
the PubMed integration and Coach Manual sections stayed in the live file
since the new 2026-08-27 entry follows up on both directly. Reference-only,
not `@`-included by CLAUDE.md.

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
