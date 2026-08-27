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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-30.md`, covering the pilot
mechanism proof (2026-08-05) through the coach-chat citation-reliability
+ response-structure fix (2026-08-27) — all split out to keep this file
within Claude Code's ~15,000-character `@`-import limit. Archives aren't
always the strictly oldest material — the split point is "what's finished
and stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s,
`-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s, `-19.md`'s, `-20.md`'s,
`-21.md`'s, `-22.md`'s, `-23.md`'s, `-24.md`'s, `-25.md`'s, `-26.md`'s,
`-27.md`'s, `-28.md`'s, `-29.md`'s, and `-30.md`'s own header notes for
same-day examples of this). All archives are reference-only (not
auto-loaded by CLAUDE.md); check them for full stage-by-stage build
history, or `git log` on this file for the exact split points. This
file's active content is the "Design direction confirmed" saga
(2026-08-27) plus whatever's added after it. If this file grows too
large again, split it the same way: move whichever section is most
clearly finished (not necessarily the chronologically oldest) into a
numbered `ROADMAP-ARCHIVE-31.md`, leave a pointer note at the top of this
file, and update this paragraph.

## Design direction confirmed: black-and-white brand, not dark-only — 2026-08-27 (same day, later still)

Carl asked whether the app's colour scheme should be consistent (noticed
Training's tiles split between white `card-light` and dark `card-glass`,
and the auth pages' white form cards). Checked the actual brand — app
icon and myfitpod.co.uk are both black-dominant throughout, with white
used deliberately as small accent cards/buttons, never a full section.
Carl decided to keep the app's existing mixed light/dark card usage as
the intended direction, not something to unify to all-dark. Updated
CLAUDE.md's `Styling` line, which previously said "dark-only theme (no
light mode)" — inaccurate and now corrected. No code changes needed;
existing usage already matches.

**Correction, same day, minutes later**: Carl pushed back — "there are
pages that are STILL BLACK." Went looking properly this time and found
`globals.css` already documents the actual rule (added 2026-08-10, missed
in the first pass): page shell/hero/nav stay dark, but inner content
surfaces — forms, list rows — are supposed to go white (`card-light`).
Several real content cards were still on the dark `card-glass` style,
violating that existing rule: Dashboard's Sessions/nutrition/training-
block tiles, Check-in, Ask-your-coach, Leaderboard and Next-session
cards; Coach's Check-in card; Health's nutrition-summary and AI-Coach
upsell cards; Training's Next/Last-session cards; the Leaderboard boards
and opt-in card; `recovery-status-card.tsx` and `weekly-recommendation-
card.tsx` (shared across those pages); and the auth-callback "Signing
you in..." card. All converted to `card-light`, with body text swapped
to `card-light-muted`/inherited `card-light-foreground` — plain gold
`text-accent` was swapped out too (found it's genuinely low-contrast on
white, ~1.5:1) but solid `bg-accent` buttons were left alone since
they're self-contained and high-contrast regardless of card colour.
Deliberately left dark: the Coach chat message bubbles — conversational
UI, not a data card, and needs the dark/gold contrast against the
accent-coloured user bubble.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Not visually verified — no test-account login in
this session for browser testing, same limitation as elsewhere. Needs
Carl's own check in the app.

**Correction, same day, immediately after**: Carl sent screenshots
comparing Home (`/`) against the new Dashboard — Home still looked
wrong: one continuous white `card-light` sheet below the dark hero, with
its inner sections just outlined borders (no fill, no shadow, no black
gaps), instead of Dashboard's now-standard look of separate floating
white tiles on black. Root cause: `src/app/page.tsx` wraps its whole
content area in one `card-light` div, and `ai-coach-section.tsx` /
`upcoming-session-card.tsx` only ever had plain borders because they
were built to sit inside that shared white wrapper.

Fixed by removing the outer wrapper and converting each section (AI
Coach status, "Get Your Membership", upcoming/no-session card, Leaderboard
link) into its own `card-light` tile, matching Dashboard exactly. Also
found the *same* single-sheet wrapper used identically across ~19 other
pages (login, signup, access forms, buy-credits, buy-membership, checkin,
nutrition, workout detail, etc.) — deliberately left those alone: they're
single-purpose forms/detail pages, not hub pages stacking independent
status cards, so one continuous white sheet is the right shape there.
Home was the one page structurally like Dashboard (a hub of independent
cards) dressed in the form-page pattern instead.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. Not visually verified — same login limitation.
Needs Carl's own check.

**Correction, same day, immediately after**: Carl, forcefully — "I WANT
THE COLOUR SCHEME TO BE THE SAME THROUGHOUT THE ENTIRE APP! USING THE
MAIN DASHBOARD AS THE EXAMPLE." He was also confused for a round by
Dashboard vs. Home being two different screens (the main bottom nav's
"Coach" tab actually links to `/dashboard`, and there's no nav link back
to Home from inside the Coach/Training/Nutrition/Coach sub-app, plus the
installed PWA's `start_url` is `/book`, not `/`) — worth fixing at some
point, not done this pass, purely a navigation-clarity issue.

Explicitly stopped applying my own "forms are different from hubs"
judgement (which I'd used to justify leaving ~19 pages alone earlier the
same day) and instead applied Dashboard's exact treatment everywhere.
Root cause, found properly this time: on every one of those pages the
`card-light` class sat directly on a `flex-1` div with the page's own
`px-6`/`pb-*`/`pt-8` padding — meaning the white box's padding was
*inside* the box (so it touched every screen edge, no visible black
margin) and `flex-1` stretched it to fill the full remaining viewport
height even when content was short (the large dead white/black area in
Carl's very first screenshot). Dashboard's cards, by contrast, get their
inset from an *outer* plain padding div, with `card-light` only on the
individually-sized inner card — rounded corners and black margins fully
visible on all sides.

Fixed by restructuring all 22 remaining offenders the same way: outer
`flex-1 px-6 pb-* pt-8` div stays plain (no background, so black shows
through), `card-light` moves onto an inner div sized to its actual
content. For genuinely single-purpose pages (login, signup, forgot/
reset-password, the three access-flow steps, coach-onboarding, checkin,
coach/profile edit, buy-membership, gift-voucher x2, waitlist offer,
workout detail, nutrition) that's one card wrapping the whole form/view,
matching how a single Dashboard tile can hold one cohesive block. For
pages built from genuinely distinct sections — Shop's three nav links,
buy-credits' package-list-plus-voucher-form, and Profile's avatar/
membership/Account-list/Booking-list/Your-details blocks — each section
got split into its own separate floating tile, matching Dashboard's
actual multi-card structure rather than one shared sheet. Also found and
fixed the exact same bug in `booking-grid.tsx` (the Book tab) and
`profile-view.tsx` (Profile tab), neither of which had turned up in the
earlier page-level searches since they're components, not `app/*/page.tsx`
files themselves.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean across all 22 files. Not visually verified — same
login limitation as every other UI change this session. This is the
widest-reaching styling change of the day; needs Carl's own check across
several pages, not just one, before calling it done.

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
