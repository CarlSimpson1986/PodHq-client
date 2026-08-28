# Archive 34 — Dashboard tile cleanup + "Find a Professional" directory (2026-08-27)

Split out 2026-08-28 to keep `ROADMAP.md` within the ~15,000-character
import limit — this was the oldest section in that file at the time, and
already finished/stable/verified (see its own "Verified" note below;
still not yet applied live at the point this was archived, but the code
itself was complete). Reference-only, not `@`-included anywhere.

## Dashboard tile cleanup + "Find a Professional" directory — 2026-08-27 (same day, later still)

**Dashboard tile cleanup**: Carl — "get rid of ask your coach as it's its
own tab" and "move book your session to training." Both tiles were
genuine duplicates rather than needing new code: Coach chat already has
its own tab in the Premium nav (`MemberBottomNav`), and `/training`
already had its own equivalent "Next session" card. Removed both from
`dashboard/page.tsx`, along with the now-unused `getNextUpcomingBooking`
fetch and import.

## "Find a Professional" — personal trainer directory

Carl wants a PT marketplace modelled on Solo60's "Professional" tab (two
screenshots reviewed): a searchable/filterable directory of trainer
profile cards (photo, specialties, favourite gyms, price/hour), a profile
page, and a "More information" inquiry form (goals/budget/availability,
Send) rather than instant slot booking. Scoped via a short round of
questions before building — see podHq's `ROADMAP_HISTORY.md` (stage 41)
for the full cross-repo write-up, since the data model and admin CRUD
live there; summary of this repo's half here.

**This repo's part**: `src/lib/data/professionals.ts` reads podHq's new
`professionals` table via `createAdminClient()` (same cross-app read
pattern as `catalog.ts`/`catalog_items`). `/professionals` — own
`PageHero` + `BottomNav` (not premium-gated, not `MemberBottomNav`, same
reasoning `/leaderboard` gives for a Dashboard-linked-but-not-coaching
feature) — renders `ProfessionalsDirectory`, a client search/gym-filter
grid. `/professionals/[id]` shows the full profile plus
`ProfessionalInquiryForm` (same local-state/fetch shape as
`redeem-voucher-form.tsx`), posting to a new
`/api/member/professional-inquiries` route that inserts the inquiry then
notifies staff — reusing the exact `unanswered_chat_question` pattern
(`getStaffRecipients` + a new `professional_inquiry` event type +
template, member text through `escapeHtml()`). New `UsersIcon` added to
`icons.tsx` (no two-person icon existed); Dashboard got a matching "Find
a professional" tile next to Leaderboard, same trophy-tile precedent
(icon + centred text).

No photo-upload infrastructure exists anywhere in either app — `photoUrl`
is a plain nullable URL field, falling back to an initials avatar (same
pattern `profile-view.tsx` uses) when empty. Real trainer data and any
upload flow are both explicitly deferred; this ships with placeholder
profiles only, per Carl's own scoping answer.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean in both repos. **Not yet applied live** — migration
`0066_professionals.sql` (podHq) needs Carl to paste the full SQL into
Supabase's SQL Editor himself; nothing in either app's new code has been
exercised against a real database or a real browser session yet.

