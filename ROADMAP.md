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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-31.md`, covering the pilot
mechanism proof (2026-08-05) through the four-round black-and-white
design-consistency saga (2026-08-27) — all split out to keep this file
within Claude Code's ~15,000-character `@`-import limit. Archives aren't
always the strictly oldest material — the split point is "what's finished
and stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s,
`-21.md`'s, `-22.md`'s, `-23.md`'s, `-24.md`'s, `-25.md`'s, `-26.md`'s,
`-27.md`'s, `-28.md`'s, `-29.md`'s, `-30.md`'s, and `-31.md`'s own header
notes for same-day examples of this). All archives are reference-only
(not auto-loaded by CLAUDE.md); check them for full stage-by-stage build
history, or `git log` on this file for the exact split points. This
file's active content is the bottom-nav/trophy-icon follow-up
(2026-08-27) plus whatever's added after it. If this file grows too
large again, split it the same way: move whichever section is most
clearly finished (not necessarily the chronologically oldest) into a
numbered `ROADMAP-ARCHIVE-32.md`, leave a pointer note at the top of this
file, and update this paragraph.

## Bottom-nav "Coach" → "Premium", Leaderboard tiles get a trophy icon — 2026-08-27 (same day, later still)

Two small follow-ups once the styling sweep landed and Carl could
actually compare pages properly.

**Nav label**: Carl noticed the main bottom nav's "Coach" tab (→
`/dashboard`) undersells what's actually behind it — Training, Nutrition
and Leaderboard access too, not just AI Coach chat — and that the app's
own trial pitch already calls it a "7 Day Premium Trial"
(`trial-banner.tsx`), not a coach trial. Relabelled to "Premium" in
`bottom-nav.tsx` (route unchanged); the `/coach` section itself, its
components, and its `tourId`/DOM anchors keep their existing "Coach"
naming, since that's still an accurate name for the AI Coach feature
specifically, just not for the whole tab.

**Leaderboard tiles**: added the existing `TrophyIcon` (already used in
`more-menu.tsx`'s overflow link, just never on these tiles) above the
centred text on both the Dashboard and Home "Leaderboard →" cards,
replacing the plain left-aligned text-only link.

**CLAUDE.md**: also rewrote the `Styling` line once more — it previously
said the app's light/dark card mix was "the intended direction, not an
inconsistency to fix," which the same-day directive above superseded.
Now explicitly names Dashboard as the canonical reference and documents
the actual bug pattern to avoid (`card-light` + `flex-1` + inline
padding = full-bleed sheet) so a future session doesn't reintroduce it.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean.

## Leaderboard copy, week-strip highlight colour, Nutrition date strip — 2026-08-27 (same day, later still)

Three smaller follow-ups, same design-consistency thread.

**Leaderboard tiles**: dropped the "→" from "Leaderboard →" on both
Dashboard and Home, and rewrote the subtitle to lead with the hook Carl
suggested rather than a flat feature list — now "See how you stack up
against everyone else — sessions, streaks and steps, every gym."

**Dashboard's week strip**: `week-calendar-strip.tsx`'s "today" circle
was still gold (`bg-accent`) — inconsistent with Book's own date strip,
which highlights the selected day white-on-black (`bg-foreground text-
background`). Switched to match; this was flagged and agreed on earlier
the same session but hadn't been implemented yet.

**Nutrition date strip**: Carl didn't like the plain "← Today →" text
navigator and asked for "the scrolling calendar week" instead, same as
Book's. `nutrition-view.tsx` had no such strip before — built one from
scratch, adapting booking-grid.tsx's drag-to-scroll day strip (pointer
handlers, `scrollbar-hide`) to this component's button/`setState` model
rather than Book's `Link`-based one (Nutrition has no URL-per-date).
Window is 13 days back to 3 days forward — biased toward the past since
diary review skews backward-looking, unlike Book's forward-only 30-day
booking window. Selected day highlighted the same white-on-black way as
Book and the week strip above, for one consistent "this is the relevant
day" language across all three.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Not visually verified — same login limitation as
every UI change this session.

**Correction, same day, immediately after**: Carl, three screenshots
side by side — Book labelled the right example, Dashboard and Nutrition
both labelled wrong: "i want uniformity." The actual bug in Nutrition:
the new date strip had been nested *inside* `nutrition-view.tsx`'s white
`card-light` card rather than in the dark hero where Book's lives, so it
ended up on the wrong background with inverted colours (black pill on
white instead of white pill on black) — a real placement mistake, not
just a missed styling pass. Fixed by restructuring `NutritionView` to
own its full page body — dark hero (title/subtitle/MoreMenu + the date
strip, using `bg-foreground`/`text-background` like Book) plus the white
card below — the same pattern `booking-grid.tsx` already used, rather
than being nested inside a `PageHero` + wrapper div supplied by
`nutrition/page.tsx`. That page now just renders `<NutritionView />`
directly, same as `book/page.tsx` renders `<BookingGrid />`.

Also rebuilt `week-calendar-strip.tsx` (Dashboard's strip) to use the
exact same pill shape and weekday+day-number content as Book/Nutrition,
not its own earlier single-letter-in-a-circle design — the color fix
from earlier the same day wasn't enough on its own once shape/content
were compared side by side too.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Not visually verified — same login limitation.

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
