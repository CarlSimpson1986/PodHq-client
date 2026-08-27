# PodHQ Client — Archive 32

Split out of `ROADMAP.md` on 2026-08-27 to make room for that day's
Hypertrophy A/B/C workout rotation entry, once the live file passed its
~15,000-character budget again. These two sections were the most clearly
finished at the time of the split — small, fully-shipped design-
consistency follow-ups, superseded by the day's later "uniformity"
correction which stayed in the live file. Reference-only, not
`@`-included by CLAUDE.md.

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
