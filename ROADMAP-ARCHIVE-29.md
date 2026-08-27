# PodHQ Client — Archive 29

Split out of `ROADMAP.md` on 2026-08-27 to make room for that day's
Home-page card-style correction, once the live file passed its
~15,000-character budget again. This section was the most clearly
superseded at the time of the split — both its "deferred to next
session" follow-ups (the "functional" ban, PubMed citation hit-rate)
landed the same day and are covered by later entries still in the live
file. Reference-only, not `@`-included by CLAUDE.md.

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
