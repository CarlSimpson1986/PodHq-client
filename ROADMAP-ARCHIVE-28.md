# PodHQ Client — Archive 28

Split out of `ROADMAP.md` on 2026-08-27 to make room for that day's
design-direction entry, once the live file passed its ~15,000-character
budget again. This section was the most clearly superseded at the time
of the split — both its "deferred to next session" follow-ups (citation
hit-rate, response structure) landed the same day and are covered by
later entries still in the live file. Reference-only, not `@`-included
by CLAUDE.md.

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
