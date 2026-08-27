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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-27.md`, covering the pilot
mechanism proof (2026-08-05) through the crisis-signal-detection
build-then-correct cycle (2026-08-26) — all split out to keep this file
within Claude Code's ~15,000-character `@`-import limit. Archives aren't
always the strictly oldest material — the split point is "what's finished
and stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s,
`-21.md`'s, `-22.md`'s, `-23.md`'s, `-24.md`'s, `-25.md`'s, `-26.md`'s, and
`-27.md`'s own header notes for same-day examples of this). All archives
are reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history, or `git log` on this file for the exact
split points. This file's active content is the real PubMed integration
work (2026-08-26) plus whatever's added after it. If this file grows too
large again, split it the same way: move whichever section is most
clearly finished (not necessarily the chronologically oldest) into a
numbered `ROADMAP-ARCHIVE-28.md`, leave a pointer note at the top of this
file, and update this paragraph.

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

## Strengthened "functional" ban + PubMed citation hit-rate fix — 2026-08-27

Both items deferred from the previous session, picked up first thing.

**"Functional" ban, strengthened**: the Coach Manual's softened rule
(discourage the underlying claim, not the word) still let "functional"
through once in live testing. `coach-manual.ts` now explicitly bans the
word/phrase outright in any framing. Re-tested: still slipped through on
1 of 3 questions — prompting alone doesn't fully constrain a low-
`reasoning_effort` Groq model — so added a deterministic backstop in
`coach-chat.ts`: a regex check (`BANNED_WORD_PATTERN`) on the reply, with
one bounded retry (not a loop) asking the model to rephrase without the
word; if the retry still contains it, ships that answer anyway rather
than making a member wait on a third completion for something this
minor.

**PubMed citation hit-rate**: root-caused the previous session's
near-total miss rate. Two contributing problems, both fixed in
`pubmed.ts`/`coach-chat.ts`:

1. `searchPubMed()`'s plain relevance-sorted `esearch` has no concept of
   evidence quality — a narrow single-study paper sharing vocabulary with
   the query can outrank a genuinely authoritative review. Now a
   two-tier search: try filtered to secondary/synthesized evidence first
   (`meta-analysis[pt] OR systematic review[pt] OR randomized controlled
   trial[pt]`), fall back to the previous unfiltered query only if that
   returns nothing (so a niche topic with no reviews yet doesn't come
   back empty). `maxResults` raised 3→5 for more candidates.
2. The bigger factor: PubMed does literal-term matching, not stemming —
   "rep" does not match "repetition." The `search_pubmed` tool's own
   description (and the system prompt's example) had been guiding the
   model toward exactly this kind of casual gym phrasing. Rewrote both to
   push full clinical/research terms with a concrete good-vs-bad example.
   Isolated live testing against the real PubMed API confirmed this
   was the dominant factor: the literal query "resistance training rep
   range hypertrophy" returned 0-1 weak hits even with the evidence
   filter, while "resistance training repetition range hypertrophy"
   returned 5 directly on-topic meta-analyses/systematic reviews for the
   identical underlying question.

**Live-tested end-to-end against real Groq + PubMed** (throwaway script,
same pattern as prior live tests this project): 2 of 3 test questions
now return correctly-cited real papers — a rep-range question cited
Schoenfeld et al. (J Strength Cond Res 2017), a protein-timing question
cited Areta et al. (2013) — versus the prior session's near-total miss
rate. The third question (a comparative opinion question, "is a squat
really better than a leg press") correctly triggered no tool call at
all, since it isn't really a citable-claim question — not treated as a
regression.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Both the banned-word retry logic and the PubMed
query/search changes were live-tested against the real Groq/PubMed APIs
(see above) before shipping.
