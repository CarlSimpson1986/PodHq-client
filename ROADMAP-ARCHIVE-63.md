# Archive 63 — Exercise catalog extended for Carl's own technique videos (2026-09-06)

Split out of `ROADMAP.md` 2026-09-06 to stay under the ~15,000-character
import limit — this section was fully finished and verified live. See
`ROADMAP.md`'s own header for the full archive-splitting convention.

## Exercise catalog extended for Carl's own technique videos — 2026-09-06

Carl filmed ~75 of his own exercise-technique clips and uploaded them
all through podHq's `/exercise-videos` admin page (full upload-side
detail, including a real browser-automation limitation and its fix, is
in podHq's own ROADMAP_HISTORY.md, stage 60). This is the client-side
catalog/content work that upload needed.

**22 new exercises added to `exercise-catalog.ts`.** 5 promoted from
clips that would otherwise have lost a slot to a collision on an
existing key (`plank_elbow`, `side_plank`, `cable_lateral_raise_standing`,
`kettlebell_single_arm_swing`, `cable_rope_pushdown`), plus 15 new ones
across chest/back/legs/arms/core, plus `hanging_knee_raise`/
`hanging_leg_raise`. Every one carries a **draft** `safetyTip` flagged
in-code for Carl to review before it's treated as final — this file's
own convention is that injury-risk copy is human-written, never
LLM-generated, and that matters more than usual here since these pods
are unmanned with no staff backstop.

**`pull_up_bar` added as a new `EquipmentType`** (duplicated in podHq's
`src/lib/data/types.ts` + its `/pods` calendar equipment checkboxes, per
the existing cross-repo convention) — Carl confirmed Hove actually has
one before this was added. Still open: confirm Hove's
`pod_resources.equipment` row actually has it checked in `/pods`, or
the two hanging exercises will never actually get prescribed despite
the code supporting them now.

**Warm-up/cool-down gained video support it never had.**
`warmup-cooldown.ts`'s `WarmupCooldownItem` had no `key` field at all —
added one to every item (old and new), and `workout-view.tsx`'s
warm-up/cool-down checklist now shows a video under any row with one,
the same `exerciseVideoOverrides[key]` lookup the main exercise view
already used. 7 new stretch/mobility items added alongside the 4
pre-existing ones (cat-cow, hamstring sweep, calf/glute/hip-flexor/lat
stretch, pigeon pose) — their instructions are drafts too, same
review caveat as the safetyTips above.

**Premium/AI-Coach waiver clause added to Clause 18 (WAIVER)**, in both
`waiver-terms.ts` (the real member-facing waiver at `/access/waiver`,
first-person voice) and `terms-and-conditions.ts` (the chatbot's
second-person reference transcription of the same document): technique
videos and AI-selected/generated workouts are general guidance only,
not personalised medical/professional advice, and the member is solely
responsible for judging whether an exercise/weight/equipment item suits
them. Not legally reviewed — wording matched to each document's
existing voice, not drafted independently; if Carl maintains a separate
master PDF as the actual source of truth, it needs the same addition
there too.

Verified via podHq's own `/api/exercise-videos` endpoint after each
upload batch (override count/keys checked against what should have
just landed — 75 at the end, folder confirmed empty of anything left
unmatched).

**`npx vitest run` caught a real bug before it shipped**: "softly
prefers compound lifts during a strength block" failed after the
catalog additions — `selectExercises()`'s Strength-block compound
preference is a flat array-order slice, not muscle-group-aware, so
marking `lat_pulldown_v_grip`/`lat_pulldown_double_handle` (grip
variants of the pattern `lat_pulldown` already covers) as
`isCompound: true` let a generated session end up with three
lat-pulldown variants and no chest/shoulder exercise. Fixed by setting
those two, plus `kettlebell_single_arm_swing` (same reasoning — same
hip-hinge pattern as the two kettlebell swings already marked
compound), to `isCompound: false`. Full suite clean after: `tsc
--noEmit`, eslint, `npx vitest run` (178/178) in this repo; `tsc`,
eslint, `npx vitest run` (9/9) in podHq.
