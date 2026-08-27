# PodHQ Client — Archive 33

Split out of `ROADMAP.md` on 2026-08-27 to make room for that day's
blank-first-time-weight entry, once the live file passed its
~15,000-character budget again. This "uniformity" date-strip correction
was the oldest active section at the time of the split, fully shipped
and superseded by everything since. Reference-only, not `@`-included by
CLAUDE.md.

## Nutrition date strip placement fix ("uniformity" correction) — 2026-08-27

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
