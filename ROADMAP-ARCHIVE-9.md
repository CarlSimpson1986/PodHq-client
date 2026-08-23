# ROADMAP Archive 9 — Nutrition/Leaderboard/Challenges Stage 7 (2026-08-23)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-23 once that file exceeded Claude Code's ~15,000-character
`@`-import limit, to make room for the Coach Dashboard Stage 10a
writeup. Covers Stage 7 (UK food database, MyFitnessPal-style nutrition
diary, custom foods, cross-browser barcode scanning) of the Nutrition/
Leaderboard/Challenges plan. Stage 6 is in `ROADMAP-ARCHIVE-8.md`. The
Coach Dashboard work that followed continues in the active `ROADMAP.md`.

## Hove AI Coach — Nutrition, Leaderboard & Challenges, Stage 7 — 2026-08-23

Continues the plan agreed via Plan Mode
(`C:\Users\carls\.claude\plans\fluffy-sparking-fox.md`) after Stage 6
shipped deterministic nutrition targets (Harris-Benedict BMR, activity
multiplier, calorie/macro targets with safety floors — see
`ROADMAP-ARCHIVE-8.md`). Four stages total: 6 (done), 7 (food search +
logging, this entry), 8 (leaderboard), 9 (challenges, podHq admin +
podhq-client member). Separately, YouTube-embed architecture for
per-exercise technique videos was also built this session (CSP
`frame-src` allowance for `youtube-nocookie.com`, a `youtubeVideoId?`
field on `CatalogExercise`, `workout-view.tsx` embeds it when set and
falls back to the existing auto-loop photos otherwise) — Carl is picking
the actual 11 video links to fill in.

**Real correction from Carl, before any Stage 7 code was written**: "why
USDA? what about in England?" — a fair challenge to the Stage 6 plan's
USDA FoodData Central fallback (US-focused) for a UK gym's members.
Researched real alternatives rather than defending the original choice:
**Public Health England's own McCance & Widdowson's Composition of Foods
Integrated Dataset (CoFID)** is a free government dataset (~2,850 usable
foods after dropping rows missing a name or one of the four macros this
app needs, out of ~2,890 total) covering exactly this need — no live API
exists for it (it's a downloadable spreadsheet from
gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid),
so it's imported **once** into a new `uk_food_composition` table
(`podHq/supabase/migrations/0052_uk_food_composition.sql` +
`0053_uk_food_composition_seed.sql`, generated from the real 2021 xlsx
via a throwaway parse script, spot-checked against known values —
grilled chicken breast 148kcal/100g, raw banana 81kcal/100g, both correct)
rather than called live. This is a genuine architecture improvement, not
just a UK-flavoured substitute: zero rate-limit risk, zero API-key
dependency, zero third-party outage risk for the generic-food half of
search, and it drops the earlier "Carl needs a USDA key" action item
entirely. Open Food Facts stays as the search fallback for branded/
packaged UK products (real Tesco/Sainsbury's/Asda coverage confirmed live
against the real API before writing the client code), plus a direct
barcode-lookup endpoint that doesn't touch OFF's rate-limited search path
at all.

**Second real correction, same message**: "the UX needs upgrading looks
very basic — I want it to mimic my fitness pal or nutracheck." Stage 6's
plain number-card page was deliberately minimal per the original plan,
but Carl's ask reshaped Stage 7 into a proper diary, not a bigger version
of the same cards: a calorie ring (consumed/remaining, MFP's signature
layout) with protein/carbs/fat progress bars underneath; four meal
sections (Breakfast/Lunch/Dinner/Snacks — `food_log_entries` gained a
`meal` column) each with their own subtotal and "+ Add" action; an
add-food sheet with three tabs — **Recent** (the member's own most-
recently-logged distinct foods, reconstructed to per-100g values so a
different quantity can be logged next time, one-tap re-log), **Search**
(debounced 400ms/min-3-chars, CoFID first then Open Food Facts fallback),
and **Scan** (barcode via the browser's `BarcodeDetector` API against the
device camera, direct Open Food Facts product lookup — gracefully hidden
on browsers without `BarcodeDetector`, e.g. Safari/iOS, with Search
always available as the real fallback, not a broken control left
visible).

**Built**: `src/lib/nutrition/food-search.ts` (CoFID via `ilike`, Open
Food Facts search/barcode fallback, 24h in-memory cache — flagged in code
as weaker than it looks on Vercel's per-instance serverless model, with
a documented next step if 429s show up in logs). `src/lib/coach/food-log.ts`
(log/delete/day-totals/recent-foods, denormalized calories/macros at log
time, same reasoning as `workout_exercises`). Five new
`/api/member/nutrition/*` routes (food-search, barcode/[barcode], recent,
log, log/[id] DELETE, day), all IDOR-guarded on delete, all on a tighter
20/min rate limit for food-search specifically (defense in depth
alongside the client debounce, protecting OFF's real shared 10/min search
budget). New `NutritionView` client component replaces Stage 6's static
cards entirely.

**Real lint catch, not shipped broken**: three `react-hooks/set-state-in-effect`
errors from calling `setState` synchronously inside `useEffect` bodies
(the day-load effect's `setLoading(true)` running before its first
`await`, a debounce branch's early `setResults([])`, and the barcode
tab's mount-time support check) — fixed with the same `queueMicrotask`
deferral podHq's own `promo-codes-view.tsx` already uses for its
load-on-prop-change effect, plus moving the barcode-support check to a
lazy `useState` initializer instead of an effect entirely.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (32/32
passing — Stage 6's targets tests still green, no regressions), and
`next build` all passed clean, including all 5 new API routes and
`/coach/nutrition` registering correctly. Open Food Facts' real search
and barcode-lookup endpoints were hit directly (not mocked) to confirm
the actual field names before writing `food-search.ts` against them.
CoFID's real 2021 dataset was downloaded from the live gov.uk URL,
parsed, and spot-checked before committing the seed migration.

**Carl ran the three migrations, then asked two more real questions
before calling it done**: "what happens if something isn't in there?"
and, once told there was no fallback for a genuinely-missing food, "what
does MyFitnessPal use?" — researched MFP's actual behaviour rather than
guessing (a "Create a new food" option on empty search results, saved for
reuse) and matched it: `FOOD_LOG_SOURCES` gained a `"manual"` value, a
"Create a custom food" prompt appears under an empty search, and a
persistent **Custom** tab (not just a not-found fallback) sits alongside
Recent/Search/Scan — feeds the same per-100g fields into the existing
`QuantityStep`, no new logging path needed. Custom entries also show up
under Recent afterwards, same as any other logged food.

**Second real question, same message**: "how do we get a bar code
scanner?" — surfaced a gap in the original `BarcodeDetector`-based Scan
tab that hadn't been stated plainly enough: Safari/iOS implements
`BarcodeDetector` nowhere, meaning roughly half of UK mobile members
would silently never see a working scanner. Researched real cross-browser
alternatives rather than defending the original choice — replaced it with
`html5-qrcode` (decodes frames itself via canvas, not a native browser
API, so it works the same on iOS Safari/Android Chrome/desktop),
dynamically imported so its ~230KB isn't in the main bundle for members
who never open Scan. **Real bug found while wiring it up**: typing the
scanner ref as `useRef<import("html5-qrcode").Html5Qrcode | null>` —
an inline type-only import of a dynamically-imported package — broke
Next's client-component boundary transform; `NutritionView`'s own import
resolved to `Promise<undefined>` at render time (a confusing "lazy
element type" error with no connection to barcode scanning on its face).
Fixed by typing the ref structurally (`{ stop: () => Promise<void> }`)
instead of importing the package's type.

**Verified live end-to-end** via a throwaway member (gender Female,
65kg/165cm/28/3 sessions/fitness — targets hand-checked: 2,230kcal/117g
protein/287g carbs/68g fat, all matched exactly): searched a real CoFID
food ("porridge oats, unfortified", 381kcal/100g, matching the earlier
spot-check), logged 50g, confirmed the quantity-scaled macros and the
day's calorie ring/macro bars updated correctly against the real
unrounded per-100g values (10.9g protein × 0.5 → 5.45g, not naively
rounded from the already-rounded 11g shown per 100g); deleted it,
confirmed totals reset to zero; created a custom food ("Carl's Homemade
Chicken Curry", 180/15/8/10), logged it, confirmed it appeared correctly
under Lunch and under Recent for reuse; opened Scan and confirmed
`html5-qrcode` loads and starts without crashing, correctly showing a
graceful "Camera access denied or unavailable" message with no real
camera attached to the test environment — a genuine physical-camera scan
still needs testing on a real device, the one piece automated
verification can't cover. `npx tsc --noEmit`, `eslint`, `npx vitest run`
(32/32), and `next build` all passed clean on this final pass too. Test
member and scratch scripts deleted after.

**Minor known rounding quirk, not fixed**: the pre-log quantity preview
rounds from the food's live unrounded per-100g values, while the stored
entry rounds to one decimal place first, then displays round to whole
numbers — occasionally shows a 1g/1kcal difference between the preview
and what's saved (e.g. previewed as 5g protein, stored/displayed as 6g).
Never off by more than rounding noise; not worth the complexity of a
single shared rounding path for this beta.

This closes out Stage 7. Coach hub's Nutrition card already links to a
fully working diary, not just targets.

**Action item only Carl can do, still open**: pick a contact string for
the Open Food Facts `User-Agent` header (`OPEN_FOOD_FACTS_CONTACT` env
var — falls back to an honest placeholder if unset, so this isn't
blocking, just recommended before real member traffic hits it).
