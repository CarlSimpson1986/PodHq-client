# Archive 36 — Blank first-time exercise weight (2026-08-27)

Split out 2026-08-28 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, finished and
verified live the same day it was written. Reference-only, not
`@`-included anywhere.

## Blank first-time exercise weight — 2026-08-27 (same day, later still)

Carl caught a real gap in the checkpoint discussion itself, before any
of it shipped: asked why photos weren't real GIFs/videos (the app
already has a `youtubeVideoId` mechanism for that, just never populated
— Carl picks these himself, same "never auto-picked" convention as
safety tips), then floated letting members add fully custom exercises.
Followed that to its logical safety question — a custom exercise has no
catalog starting weight, so it'd start blank — which Carl then flipped
back onto the *existing* catalog exercises: pre-filling a "conservative"
per-experience-level default is still the app guessing, and a beginner
left to interpret a blank field on their own can genuinely misjudge
what's safe (his example: thinking "the bar plus 10kg" is light,
without realising an empty barbell is already ~20kg on its own).

**Decision**: every exercise, catalog or (future) custom, starts
genuinely blank the very first time a member ever does it — no default
weight suggested at all. The member logs their own real weight, and the
existing RPE-based progression takes over from their second time on,
exactly as it always has for every session after the first. Also:
members should be encouraged to try a lighter warm-up set or two first
before committing to their logged work-set weight.

**What changed**: `startingWeightKg` removed entirely from
`exercise-catalog.ts` (dead data now — 18 entries cleaned up).
`computeWeightKg`/`computeWeightKgForBlock` (`generate-workout.ts`) now
return `number | null`, `null` on the `!prior` branch instead of a
catalog default. That ripples through `GeneratedExercise`,
`WorkoutSet.weightTargetKg`, and — since this app's Supabase layer isn't
strictly typed against generated DB types — several spots TypeScript
wouldn't catch on its own, fixed by hand: `applyRecoveryAdjustment`
skips a still-blank target instead of `null * multiplier` silently
becoming a wrong `0`; `completeSession`'s next-session weight-change
preview filters out any comparison where either side is blank;
`coach-bot.ts`'s session-intro narration describes a blank target as
"starting weight to be logged" instead of interpolating a literal
"nullkg" into the model's prompt. `workout-view.tsx`'s weight state
became `number | ""` (blank, not `0` — `0` is a real bodyweight-exercise
value already, reusing it as a blank sentinel would have been
ambiguous), the input shows a placeholder instead of a pre-filled
number, "Log Set" is disabled until something's entered, and moving to
the next *set of the same exercise* carries forward whatever was just
typed (so a first-timer isn't retyping the identical number 2-3 times)
while moving to a *different* exercise always resets to blank. A hint
under the input explains why it's blank and encourages the warm-up-set
suggestion — folded into the existing hint rather than building a
separate structured warm-up-set feature, since "encouraged" was Carl's
own word for it, not a request for tracked/logged warm-up sets.

New migration `0068_workout_sets_blank_first_weight.sql` drops
`workout_sets.weight_target_kg`'s `not null` constraint — it was only
ever `not null` because a real number was always computed before.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (105/105 —
one existing test updated for the new behaviour, no new failures
elsewhere), and `next build` all clean. **Not yet live** — migrations
`0067` and `0068` both need Carl's own paste into Supabase's SQL Editor;
nothing in this change has touched a real database or browser session
yet.

