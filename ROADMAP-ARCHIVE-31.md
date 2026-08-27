# PodHQ Client — Archive 31

Split out of `ROADMAP.md` on 2026-08-27 to make room for that day's "Find
a Professional" feature entry, once the live file passed its
~15,000-character budget again. This was the single largest section at
the time of the split — the full black-and-white design-consistency saga
(four escalating correction rounds in one day) — and was fully resolved
by day's end, superseded by the shorter follow-up entries that stayed in
the live file. Reference-only, not `@`-included by CLAUDE.md.

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
