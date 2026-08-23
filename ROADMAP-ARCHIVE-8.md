# ROADMAP Archive 8 — Nutrition/Leaderboard/Challenges Stage 6 (2026-08-23)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-23 once that file exceeded Claude Code's ~15,000-character
`@`-import limit, to make room for Stage 7's live-verification writeup.
Covers Stage 6 (deterministic nutrition targets — BMR, activity
multiplier, calorie/macro targets, safety floors) of the Nutrition/
Leaderboard/Challenges plan. Stage 7 (food search + logging) continues in
the active `ROADMAP.md`.

## Hove AI Coach — Nutrition, Leaderboard & Challenges, Stage 6 — 2026-08-23

New multi-stage addition after Carl asked to finish "the whole journey
including nutrtion and calorie counting and challenge/leader board." Full
plan agreed via Plan Mode
(`C:\Users\carls\.claude\plans\fluffy-sparking-fox.md`), pressure-tested
by a Plan agent before building — real corrections came out of that pass
(see below), the same "verify before trusting a draft" discipline this
project has applied throughout. Four stages: 6 (nutrition targets,
today's work), 7 (food search + logging), 8 (leaderboard), 9 (challenges,
podHq admin + podhq-client member). Separately, YouTube-embed
architecture for per-exercise technique videos was also built this
session (CSP `frame-src` allowance for `youtube-nocookie.com`, a
`youtubeVideoId?` field on `CatalogExercise`, `workout-view.tsx` embeds it
when set and falls back to the existing auto-loop photos otherwise) —
Carl is picking the actual 11 video links to fill in.

**Stage 6 — nutrition targets, pure deterministic math, no logging yet.**
`src/lib/coach/nutrition-targets.ts`: Harris-Benedict BMR (the formula
the brief specifies; documented as a known overestimate vs. Mifflin-St
Jeor for a general population, a revisitable spec choice not a silent
default), activity multiplier derived from `sessions_per_week` (1-2→1.375,
3-4→1.55, 5-6→1.725 — deliberately no "sedentary" tier since the schema
guarantees `sessions_per_week >= 1`), goal-based calorie adjustment
(weight_loss −500, muscle_gain +300, fitness/strength maintenance),
protein reusing the existing 1.8g/kg constant unchanged, fat as 27.5% of
the calorie target (not a flat g/kg — matches actual ISSN/DGE guidance),
carbs as the remainder. Two new safety constants in `types.ts`:
`CALORIE_TARGET_FLOOR = 1200` (a lighter member on an aggressive deficit
could otherwise land below the general medical-supervision-free floor —
same bug shape as the earlier "wrongly marked optional" mistake, caught
before shipping this time) and a defensive `Math.max(0, carbsG)` floor for
the theoretical edge where protein+fat could otherwise exceed a
floor-clamped calorie target.

**Real correction from the Plan-agent pressure-test, not shipped as
originally drafted**: fat was originally drafted as a flat 0.8g/kg,
mirroring the protein constant's style — wrong basis. Sports-nutrition
guidance specifies fat as a % of energy intake, not a bodyweight ratio;
a flat g/kg number independent of the calorie target could drive carbs
negative for a heavier member on a deficit. Changed to 27.5% of the
calorie target before writing any code.

**Built**: `/coach/nutrition` (same `hasPremium` + `coachProfile` gate as
`/workout/[bookingId]`) shows the four computed targets — no search/
logging yet, that's Stage 7. Coach hub's Nutrition placeholder card now
links here instead of saying "coming soon."

**Verified**: 8 new unit tests (`nutrition-targets.test.ts`) — both
gender formulas, null/"Prefer not to say" averaging, all three activity
tiers, each goal's adjustment, the calorie floor actually clamping, and a
deliberately synthetic extreme (age=1000, beyond any real zod-validated
input) proving the carbs defensive floor never goes negative. Live
click-through via a throwaway member with a hand-picked profile
(80kg/180cm/30/Male/4 sessions/fitness) confirmed the on-screen numbers
matched the hand-calculated and unit-tested values exactly: 2,873 kcal /
144g protein / 377g carbs / 88g fat. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (32/32 passing), and `next build` all passed clean. Test
member and scratch scripts deleted after.

**Action items only Carl can do, ahead of Stage 7**: pick a contact
string for the Open Food Facts `User-Agent` header; confirm (or override)
the 1200kcal safety floor. (A third item — signing up for a USDA
FoodData Central key — was planned here but dropped before Stage 7
started; see `ROADMAP.md`'s Stage 7 entry.)
