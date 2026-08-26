# ROADMAP Archive 23 — Continuous-improvement loop for POD chat (2026-08-26)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-26 once that file again approached Claude Code's ~15,000-character
`@`-import limit. Covers the same-day continuous-improvement loop build:
the FAQ moved from a static code file to a DB table (`help_faq_items`),
unanswered questions logged and emailed to staff, reviewable in podHq's
new `/chat-questions` page — fully shipped and confirmed working live the
same day. Superseded as the day's active thread by the cross-gym PAYG
booking work that remains in `ROADMAP.md`.

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
membership use) correctly triggered the `<<STAFF_FOLLOWUP>>` marker,
landed in podHq's Chat Questions queue, and the staff email arrived —
the full loop working end to end, not just a clean build.
