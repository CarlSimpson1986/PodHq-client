# ROADMAP Archive 14 — Equipment-Aware AI Coach Workout Generation (2026-08-24)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-24 (same day it was written) once that file exceeded Claude
Code's ~15,000-character `@`-import limit again — the wearable-
integration research thread was still actively being worked through live
in the same session, so this finished, fully-shipped feature was moved
out first instead of splitting by strict date order, keeping the active
research note in the fast-loaded file. The wearable-integration research
note and everything after it continue in the active `ROADMAP.md`.

## Equipment-aware AI Coach workout generation — 2026-08-24

Carl flagged that Lat Pulldown/Seated Row are prescribed as if every pod
has a dedicated machine for them, when in reality they (and Tricep
Pushdown) need to be done on a cable machine — and confirmed via
`AskUserQuestion` that the real fix is bigger than copy: `EXERCISE_CATALOG`
was one hardcoded list tuned to Hove's equipment, applied to every gym
regardless of what that gym's pod actually has (`hasPremium()`, which
gates AI Coach access, isn't gym-scoped at all). Designed via Plan Mode
before building; confirmed with Carl: one `cable_machine` category (not
split by pulley type — that nuance stays in exercise copy); an
unconfigured gym stays unrestricted (today's exact behavior) until Carl
explicitly sets its equipment; config lives in podHq's existing pod
Settings panel, not a new page.

**Data model**: `pod_resources.equipment text[] not null default '{}'`
(podHq migration `0056_pod_resources_equipment.sql`, no CHECK constraint,
same TS-union-at-the-boundary convention as `credit_type`) — empty means
unconfigured/unrestricted, not "no equipment." New `EQUIPMENT_TYPES`
union (`barbell_rack`/`cable_machine`/`dumbbells`/
`leg_extension_curl_machine`) duplicated verbatim across both repos'
`types.ts`, same convention as `GYM_NAMES`. Each `CatalogExercise` gained
`requiredEquipment: EquipmentType | null` (`null` for Plank).

**Generation**: `generateWorkout`'s `availableEquipment?: EquipmentType[]`
is optional, same "absent = byte-identical to before" idiom Stage 12 used
for `activeBlock` — `getOrCreateWorkoutSession` now looks up the
booking's resource's `equipment` and passes it through; a new
`getEquipmentExcludedKeys` mirrors `getInjuryExcludedKeys` and is unioned
with it into the single `excludedExerciseKeys` field the client already
reads for swap candidates, so the swap UI picked up equipment-awareness
with no client-side change needed.

**Real gap found and fixed along the way**: `swapExercise` had zero
gym/resource awareness before this — a member could swap into an
exercise their actual pod couldn't support even though the client's own
candidate list would never offer it. `workout_sessions.resource_id` (on
the row since resources existed, just never selected) is now read via a
new `getSessionResourceId`, and the swap re-validates equipment
server-side the same way it already re-validated injuries.

**podHq**: `PodResource` gained `equipment`, threaded through
`getPodResourcesForGym`/`getPodResourceById`/`updatePodResourceSettings`/
`updatePodSettingsSchema`; the pod Settings panel
(`calendar-view.tsx`) gained one checkbox per equipment category next to
the existing capacity/hours fields.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (podhq-client
67/67 including 5 new equipment tests; podHq 9/9), and `next build` all
clean in both repos. Carl ran the migration live in Supabase before this
was committed, specifically to avoid the AI Coach 500ing for every member
between a code deploy and the column existing (`getResourceEquipment` is
on every generate/resume/swap call path). **Still outstanding**: no gym's
`pod_resources.equipment` has actually been set yet (including Hove's
real, already-confirmed equipment) — every gym is still running
unrestricted until Carl works through the new Settings panel checkboxes
gym by gym.
