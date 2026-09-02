# Archive 52 — PubMed citations made independently verifiable (2026-08-30)

Split out 2026-09-02 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## PubMed citations made independently verifiable — 2026-08-30

Carl asked how anyone could check the AI Coach's PubMed citations were
correct — until now the model was only *instructed* not to invent one
(`coach-chat.ts`'s system prompt), with no technical backstop and nothing
in the UI a member or Carl could actually click to verify.

**Model now tags every real citation with its PMID**, copied verbatim
from `search_pubmed`'s own tool output (which already prefixed each
result with `[PMID n]` — the model just wasn't asked to echo it back).
**Server-side backstop, not just a prompt change**: `pubmed.ts` gained
`extractCitedPmids()` (reads the real PMIDs out of a formatted tool
result) and `sanitizeCitedPmids()` (strips any `[PMID n]` tag in the
model's reply that isn't in that set). Both `askGroq` and `askClaude`
now accumulate a `knownPmids` set from every `search_pubmed` call made
that turn and run the final reply through the sanitizer before
returning it — a hallucinated PMID degrades to an unlinked sentence
(same as before this stage), never a fake-but-clickable citation.

**UI renders the tag as a real link** (`coach-chat-view.tsx`): assistant
messages are split on the `[PMID n]` pattern and each match becomes an
`<a href="https://pubmed.ncbi.nlm.nih.gov/{n}/">` — one tap confirms the
study is real.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (178/178, +6 new
for `extractCitedPmids`/`sanitizeCitedPmids` covering the known/unknown/
empty-set cases), and `npm run build` all clean. Live-tested against the
real Groq + PubMed APIs in local dev (not the deployed preview) with
debug logging temporarily added and removed after: a no-results query
correctly produced no citation and no tag; a real query returned 5 real
PMIDs and the model's reply cited `[PMID 35986981]` — a genuine 2022
*Nutrition* meta-analysis actually in that result set — which rendered
as a working link in the UI. Also root-caused why two earlier live tests
that session had shown citations with no PMID tag at all: they'd hit a
dev server process still running the pre-edit code (Turbopack doesn't
always hot-reload a `server-only` lib change for an API route) — killing
and restarting it fixed it, consistent with prior stale-bundle issues
this project has hit before.

**Not built this stage**: no check that the citation's *claim* (not just
the PMID) accurately reflects the abstract — the sanitizer guarantees
the PMID is real, not that the summary is a faithful one; that still
needs an occasional human spot-check.
