# ROADMAP Archive 22 — POD chat fixes: dead in production, invisible input text, tour-replay chip (2026-08-26)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day POD chat fixes: `GROQ_API_KEY`
missing from podhq-client's own Vercel project (root cause of the dead
chat), the invisible white-on-white input text, and the "Replay app
tour" quick-question chip — fully shipped and confirmed working live
(Carl exercised the flagged-question path end to end the same day, per
the Continuous-improvement-loop entry that remains in `ROADMAP.md`).

## POD chat fixes: dead in production, invisible input text, tour-replay chip — 2026-08-26

Carl reported the "?" chat ("POD", `help-chat-view.tsx` /
`src/lib/help-bot.ts`) didn't work at all live, plus the chat's own text
input showed typed text in white (invisible against the panel).

**Root cause of the dead chat — not a code bug**: `askHelpBot` throws if
neither `GROQ_API_KEY` nor `ANTHROPIC_API_KEY` is set, and podhq-client's
Vercel project had never had either — `GROQ_API_KEY` was only ever
configured for the sibling `../podHq` project, and (being a fully
separate Next.js app/deploy per this file's own header) podhq-client
needed its own copy, which it never got. Confirmed locally first (a
throwaway Node script loaded `.env.local` and called the real Groq
endpoint directly — 200 OK, valid reply — ruling out the prompt/logic
itself), then confirmed via `vercel env ls production` that the key was
absent from this project specifically. Fixed by adding `GROQ_API_KEY` to
this project's Production (and initially Preview, though Carl later said
Vercel only let him pick one scope at a time when he went to configure
it himself, so Preview may still need doing manually — Production is
what live members hit and is confirmed set).

**Invisible input text**: `help-chat-view.tsx`'s `<input>` never set a
text colour, so — sitting inside the white `.card-light` panel while the
rest of the app is dark-themed white-on-black — it inherited the global
white body colour with no background override, i.e. white text with no
opaque background under it. Fixed by adding `text-card-light-foreground`
(the pattern already used in `buy-credits-list.tsx` etc.).

**"Replay app tour" as a chat question**: added a quick-question chip
row shown when the chat is empty — "Replay app tour" plus the 3
`FAQ_ITEMS` questions. Tour replay is a UI action the LLM can't perform,
so that chip bypasses the API entirely and calls the same `driver.js`
`.drive()` the existing "?" menu item already uses, via a new
`onReplayTour` prop passed down from `onboarding-tour.tsx`; the FAQ
chips send their question straight into the existing chat flow.

**Verified**: `npx tsc --noEmit` and `eslint` on both changed files clean.
Not yet re-tested live post-deploy (no test-account password in this
session, same limitation as the 2026-08-25 client-cache session).

**Friction, worth noting**: this session ran `vercel env ls production`
to diagnose the missing key, which surfaces variable *names* (not
values — Vercel's CLI shows `Hidden` for every value). Carl reacted
strongly to seeing even just names of production env vars in the
conversation without being asked first, despite no value ever being
displayed or logged. Going forward: always ask before running any
`vercel env ls/add/rm` (or equivalent) against either Vercel project,
even for a read-only names-only listing.
