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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-26.md`, covering the pilot
mechanism proof (2026-08-05) through the network-credit live-testing
follow-ups (2026-08-26) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s,
`-21.md`'s, `-22.md`'s, `-23.md`'s, `-24.md`'s, `-25.md`'s, and `-26.md`'s
own header notes for same-day examples of this). All archives are
reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history, or `git log` on this file for the exact
split points. This file's active content is the equipment-aware AI
Coach work (2026-08-24) plus whatever's added after it. If this file
grows too large again, split it the same way: move whichever section is
most clearly finished (not necessarily the chronologically oldest) into
a numbered `ROADMAP-ARCHIVE-27.md`, leave a pointer note at the top of
this file,
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

## Real PubMed integration for the AI Coach — 2026-08-26 (same day, later still)

Closes the gap flagged in the original redesign plan: `coach-chat.ts`
previously avoided citing any specific study by design ("ship it
softened" — a wrong citation is a real trust risk for a health app), so
it only ever framed research as general evidence-based practice. Carl
asked to build the real thing instead.

**First real tool-calling in either chat** (confirmed absent in the
earlier OWASP audit) — the model gets a `search_pubmed` tool and decides
*itself* whether a question genuinely warrants a lookup, rather than a
keyword heuristic on this side; its own judgment of "is this a real
research-backed claim" is more accurate than pattern-matching would be.
New `src/lib/coach/pubmed.ts` wraps NCBI's E-utilities (esearch +
esummary + efetch for abstracts) — unauthenticated (3 req/sec, no
signup), since this app's realistic volume doesn't need the optional
free API key, which would require Carl personally creating an NCBI
account (real account creation, not something to do on his behalf).
`tool`/`email` self-identification params are just plain strings, no
registration involved.

Citation is now allowed but strictly gated: only from what the tool
actually returns, never invented — same underlying trust concern as
before, just given a real way to be right instead of avoiding the
question shape entirely. Implemented for both providers (Groq's OpenAI-
compatible tool format, Anthropic's own) since the app switches between
them by whichever key is set; bounded to one tool round-trip per turn
(a second call with tools omitted forces a final answer) so a model that
kept calling the tool couldn't loop indefinitely.

**Live-tested against the real model before shipping**: a rep-range
question correctly triggered a tool call with a sensible search query
and a real PubMed result came back — the model then chose *not* to cite
it by name since the actual paper (a measurement-methodology study)
didn't really support the specific claim, falling back to general
framing instead of forcing an irrelevant citation. A logistics question
("how many days left in my block") correctly never called the tool at
all. Whether a visible citation actually appears depends on PubMed
surfacing something genuinely on-topic, which won't happen every time —
an accepted trade-off, since the alternative (forcing a citation
regardless of relevance) is exactly the risk this exists to avoid.

Also confirmed Carl's own test account (member 123) already had a coach
profile from an earlier session (muscle_gain, intermediate, 3
sessions/week) — no new setup needed there.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. The tool-calling loop and PubMed search were
both live-tested against the real APIs (see above).

## Coach Manual (tone/philosophy) + nutrition portion-scaling fix — 2026-08-26 (same day, end of session)

**Coach Manual**: Carl wanted to be able to shape the Coach's tone/style
himself without a code review each time, but a full admin-editable field
in podHq was overkill for a single-operator business — landed on a plain
file instead, `src/lib/coach/coach-manual.ts`, a text block Carl edits
directly (with my help) and no deploy step beyond the normal one.
Appended into `buildSystemPrompt()` as its own clearly-labelled section,
layered on top of (never able to override) the hard rules already there
— crisis detection, injection resistance, citation-only-from-real-
PubMed-results.

First draft covers: the pod format's actual appeal (a private, judgment-
free space for a genuine mix of clientele — intimidated beginners,
time-poor professionals, self-conscious members), warm-but-direct
non-patronizing tone, consistency-over-intensity (this member base
trains 2-3x/week, not like competitive athletes), no shame-based
motivation.

**Real feedback from Carl's own test conversation, acted on same
session**: reviewed his actual `coach_conversations` row (Coach chat
persists full history per member, unlike POD chat) — a "machines vs
free weights" answer had called free weights inherently more
"functional," a vague gym-culture claim without real backing (machines
and free weights produce comparable hypertrophy when volume/effort are
matched — "functional" gets used as a buzzword far more than a precise
claim). Added an explicit manual rule against repeating fitness dogma as
settled fact. Live-retested the identical question: the answer now
correctly leads with "comparable for muscle growth," though it still
used the word "functional" once, softened ("can feel more functional"
rather than stated as fact) — a real, verified improvement, not a full
elimination; Carl was told this honestly rather than oversold.

**Nutrition portion-scaling gap, found from a separate real complaint**:
Carl logged 3 real meals (smoked salmon & eggs, chicken wrap, salmon)
and found the numbers felt off. Investigated: `MealSuggestionsCard`
("What to eat next") let a member log the catalog's fixed serving with
zero ability to scale it — the ONE gap in an otherwise-working system,
since search/barcode/custom entries already had this via `QuantityStep`
(a working grams input + live-recalculated macros). Fixed by routing
suggestions through that same `QuantityStep` instead of a bespoke
fixed-log call, pre-filled at the catalog's own suggested grams (not
`QuantityStep`'s normal 100g default) so adjusting from there is a
small tweak, not starting from scratch. Also threads a `loggedDate`
prop through so a suggestion logged while viewing a non-today date still
logs to that date, matching suggestions' existing (correct) behaviour —
worth noting as a separate, pre-existing quirk found along the way:
search/barcode/custom (`AddFoodSheet`) has never respected the viewed
date at all, always logging to today regardless — not touched, out of
scope for this fix.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. The Coach Manual's "functional" fix was live-
tested against the real model; the nutrition portion-scaling fix was
not (no test-account password in this session for browser testing, same
limitation as elsewhere).

**Deferred to next session, Carl's own call**: improving how reliably
PubMed actually surfaces citable, on-topic evidence — today's build
proved the tool-calling mechanism works and is appropriately cautious
(won't force an irrelevant citation), but a real search often doesn't
surface a directly on-topic paper for a given coaching question, so a
visible citation won't appear every time it plausibly could. Also open:
whether to explicitly ban the word "functional" outright in the Coach
Manual, since the softened version still slipped through once.
