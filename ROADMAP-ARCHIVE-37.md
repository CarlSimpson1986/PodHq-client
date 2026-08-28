# Archive 37 — Exercise photos filled in + 18 more free-weight exercises (2026-08-28)

Split out 2026-08-28 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, finished and
verified live. Reference-only, not `@`-included anywhere.

## Exercise photos filled in + 18 more free-weight exercises — 2026-08-28

Migrations `0066`/`0067`/`0068` confirmed live this session (Carl pasted
them; podHq's `ROADMAP_HISTORY.md` has the verification detail, including
`0067` needing a second paste attempt after a schema-cache miss on the
first). Live-tested the A/B/C rotation and blank-first-weight together in
one real session: exercise 1 (Barbell Squat, has prior history) correctly
pre-filled from RPE progression, exercise 2 (Barbell Bench Press, no
history) correctly rendered a blank input with the "first time" hint,
`Log Set` disabled until entered — confirmed via direct DB read of
`workout_sessions`/`workout_templates`/`workout_sets`, not just the
screenshot.

**Photos**: the 7 exercises added 08-27 shipped with no images (no
fetch capability that session — see that entry above). Matched all 7
against `yuhonas/free-exercise-db`'s real index (fetched directly and
searched with a script, not trusted to a WebFetch summary — an early
attempt at that gave an unreliable partial/wrong match) and downloaded
the matching start/end JPG pairs into `public/exercises/<key>/`, same
convention as the original 11. Two calls flagged to Carl rather than
guessed: Cable Chest Fly matched to the flat-bench variant over incline
(both exist in the dataset), and Dumbbell Russian Twist has no
dumbbell-in-hand photo available — used the closest match (bodyweight
version, same movement pattern) rather than leave it blank.

**18 more free-weight exercises added**, Carl's own request ("as many
as you can think of using free weights") rather than tied to a specific
generation gap: Barbell Deadlift, Barbell Front Squat, Barbell Walking
Lunge, Barbell Hip Thrust, Barbell Step-Up (legs); Dumbbell Bench Press,
Dumbbell Flyes (chest); One-Arm Dumbbell Row, Barbell Shrug, Dumbbell
Pullover (back); Barbell Overhead Press, Dumbbell Front Raise, Dumbbell
Rear Delt Fly, Arnold Press (shoulders); Barbell Curl, Hammer Curl,
Standing Dumbbell Triceps Extension (arms); Dumbbell Side Bend (core).
Every one matched to a real `free-exercise-db` entry and verified
downloadable before adding — same draft-safety-tip convention as 08-27
(written in the existing voice, explicitly not yet Carl-reviewed),
`requiredEquipment` stays within Hove's existing `dumbbells`/
`barbell_rack` categories, no new `EQUIPMENT_TYPES` entry needed.

**AI-generated demo images considered and declined**: Carl asked about
generating on-brand (black-and-white, unbranded) demo visuals instead
of the stock photos. Flagged a real concern before building anything —
this app's own rule is that safety-critical content (technique cues)
is written by a person, never LLM-generated, specifically because bad
form guidance risks real injury; an AI-generated *photo* of "correct
squat form" is arguably higher-risk than a wrong sentence since it's
more directly copyable, and image models are unreliable at consistent
human anatomy/joint angles. Offered a black-and-white icon/pictogram
style as a lower-risk on-brand alternative instead of photoreal
generation — that path needs a `GEMINI_API_KEY` this environment
doesn't have, and Carl chose to leave the current stock photos as-is
for now rather than set one up mid-session.

**Test fix, not a regression**: two `generate-workout.test.ts` cases had
hardcoded exercise lists from before this expansion (e.g. "only
`dumbbell_bicep_curl` is safe under a shoulder+knee+back injury
exclusion") — now false since several of the 18 new exercises also
qualify under those same filters. Updated the assertions to the correct
broader safe-set, not weakened.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (105/105,
all passing after the two test updates above), and `next build` all
clean. New photos confirmed rendering via local dev server, not just
present on disk. Not yet exercised live for the 18 new exercises
specifically (no template has generated one yet — the two live-tested
today, Barbell Squat and Barbell Bench Press, both predate this batch).

