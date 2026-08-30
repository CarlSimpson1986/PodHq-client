# Archive 47 — Weekly check-in rebuilt as a real conversation (2026-08-30)

Split out 2026-08-30 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## Weekly check-in rebuilt as a real conversation — 2026-08-30

Client-perspective companion to the same day's coaching review — asked
Claude to go through the check-in "as a client" rather than a code
reviewer. Closes the two gaps the previous stage's own "Not built this
stage" note had already flagged (habit accountability, and the
review-before-listening ordering), plus the pain-acknowledgment gap
found this same session:

**Reordered.** The "coach's review" used to be generated in the GET
route, before the member had answered a single reflection question — a
report, then a form, never a conversation. Now the reflection questions
render first; the response is generated in `/complete`, after those
answers exist, and is actually built from them (mood, barriers, habit)
via a new `narrateCheckInResponse` (coach-bot.ts), not `narrateWeeklyReview`'s
old stats-only prompt. Live-verified: reporting a hectic work week and a
"partially" kept habit produced a response that named both specifically,
not a generic stats summary.

**Habit accountability, closed.** `getPreviousHabit` (check-ins.ts)
surfaces last week's commitment; the check-in now asks "how did that
go?" (No/Partially/Yes) before setting a new one — the follow-up that
was entirely missing before. The existing habit streak (`computeHabitStreak`,
previously only shown on `/coach`) is now surfaced here too, at the
moment it's actually relevant.

**Pain acknowledgment, held to the same compliance bar as wearables.**
The completed screen now acknowledges a reported pain — but via fixed,
reviewed copy (`PAIN_ACKNOWLEDGMENT`), never sent to the LLM. Not a
shortcut: `narrateWeeklyReview`'s own comment already draws this exact
line around wearable sleep/heart-rate data (a real UK GDPR Art 9
special-category-data question from an earlier legal-review session,
2026-08-28) — a pain report is the same category, so it gets the same
treatment rather than quietly reopening that question in a new spot.
Live-verified the LLM response never mentions reported pain, and
`painAcknowledgment` comes back `null` cleanly on the no-pain path.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (158/158, no
regressions), and `npm run build` all clean. Live-tested both the pain
and no-pain completion paths directly against the API (the UI itself
was already "not due" for the playground member that day, having
completed an earlier check-in — same code path either way, verified via
direct request/response rather than click-through).

**Not built this stage**: `weekFeel`/`barriers` are now at least
acknowledged by the coach's response, but nothing yet adjusts future
programming based on them (e.g. a string of "Rough" weeks doesn't
trigger anything). Habit streak still counts "weeks a habit was set",
not "weeks it was actually kept" — evolving that needs the
`habitFollowUp` data this stage just started collecting to accumulate
first.
