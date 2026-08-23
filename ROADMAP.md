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

**Stages 1-9 (pilot mechanism proof through gift vouchers, 2026-08-05 →
2026-08-15) have been moved to `ROADMAP-ARCHIVE.md`**, **2026-08-16
(OWASP audit) through 2026-08-19 (the Wellness/Recovery Room slot-duration
fix) have been moved to `ROADMAP-ARCHIVE-2.md`**, **the Stripe Connect
Hove pilot (2026-08-19) has been moved to `ROADMAP-ARCHIVE-3.md`**, **the
guided first-login tour and static FAQ, POD phase 1 (2026-08-21) have been
moved to `ROADMAP-ARCHIVE-4.md`**, **POD phase 2, the real LLM chat bot
(2026-08-22), has been moved to `ROADMAP-ARCHIVE-5.md`**, and **the Hove
AI Coach trial beta's Stages 1-4 — trial data model through the
onboarding/generate/log/RPE loop (2026-08-23) — have been moved to
`ROADMAP-ARCHIVE-6.md`** — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. All archives are
reference-only (not auto-loaded by CLAUDE.md); check them for full
stage-by-stage build history. This file picks up from the Hove AI Coach
trial beta's Stage 5 (2026-08-23) and is the active, auto-loaded log
going forward. If this file grows too large again, split it the same way
into a numbered `ROADMAP-ARCHIVE-7.md`, leave a pointer note at the top
of this file, and update this paragraph plus `CLAUDE.md`'s
session-handoff guidance to match.

## Hove AI Coach trial beta, Stage 5 — 2026-08-23

Closes out the plan's remaining polish stage after Stage 4 shipped the
core trial→onboarding→generate→log→RPE→adjust loop (see
`ROADMAP-ARCHIVE-6.md`). Carl reviewed the shipped loop live and asked
for three more things: (1) a workout overview screen plus a demonstration
image per exercise, (2) a meal-frequency selector instead of free-text
entry, (3) a dedicated "Coach" hub tab consolidating stats/workouts/
nutrition/integrations/challenges — "almost like a separate app in the
main app" — matching the original brief's 5-tab nav spec exactly. Full
plan agreed via Plan Mode before building
(`C:\Users\carls\.claude\plans\fluffy-sparking-fox.md`).

**Real discrepancy found before building, not assumed away**: the brief
claims exercise "GIFs from ExerciseDB open source GitHub repo
(yuhonas/free-exercise-db)." Checked the actual repo directly (Unlicense,
public domain) — it provides exactly two static JPGs per exercise (start/
end position), not an animated GIF. Self-hosted the matched pair per
catalog exercise under `public/exercises/<key>/{0,1}.jpg` and built a
tap-to-toggle image rather than fabricating a fake GIF from two frames.

**Real equipment correction, mid-build**: Carl supplied Hove's actual pod
equipment — dumbbells, a cable machine, a power rack with barbell and
weights, and a leg extension/lying leg curl machine (no chest-press
machine, kettlebell, or leg-press machine, all of which the placeholder
catalog had wrongly assumed). `src/lib/coach/exercise-catalog.ts` rebuilt
to an 11-exercise catalog matching exactly what's really there.

**Stage 5a built**: `workout-view.tsx` gained an `"overview"` phase
(lists every exercise with muscle group and sets×reps before starting)
between `"intro"` and the first active exercise; `coach-onboarding-form.tsx`'s
free-text "meals per day" input became a button-grid selector (2/3/4/5/
6+), matching the existing sessions-per-week pattern exactly.

**Stage 5b built**: new `SparkleIcon` (`icons.tsx`) and a 5th `bottom-nav.tsx`
entry (`/coach`, distinct from the `DumbbellIcon` already used for Book/
AI-Coach visuals). New `src/app/coach/page.tsx` hub page: full-detail
status card for all 5 trial states (reusing `getCoachHomeState()`),
today's-workout action, a "Recent workouts" list
(`getWorkoutHistory`/`getRecentCompletedSessions` in `coach-profile.ts` /
`workout-session.ts`), and three honest "coming soon" placeholders
(Nutrition, Tech integrations — explicitly explains HealthKit/Health
Connect are native-only per the brief's own §3, Challenges) rather than
faking output for features not yet built. Home's `ai-coach-section.tsx`
trimmed to a slim status pointer for `trial_active`/`subscriber` states
(props reduced to just `{ state }`) now that the Coach tab is the
dedicated space — avoids duplicating the full action set in two places.

**Verified live** via a throwaway member click-through: overview screen
listed the correct 4 exercises with accurate sets×reps; meal-frequency
grid submitted correctly; Coach tab rendered and highlighted correctly in
the bottom nav; hub showed accurate trial state and correct recent-
workout volume; Home's trimmed card linked correctly into the tab.
`npx tsc --noEmit`, `eslint`, `npx vitest run`, and `next build` all
passed clean.

**Same-day follow-up, three real corrections from live review, not
assumed-good after Stage 5a/5b's own verification passed:**

1. **Body stats wrongly marked optional.** Carl asked directly why
   weight/height/age were optional in onboarding given TDEE needs them,
   and whether body fat % or activity level were missing instead.
   Checked the actual formula before answering either way: Harris-
   Benedict BMR (what this app will use) needs weight/height/age/gender,
   not body fat % (that's Katch-McArdle, a different formula, not needed
   here) — so body fat %/activity level were correctly excluded, but
   marking the three real inputs "Optional" was a genuine bug, not a
   deliberate simplification. Fixed: `coachProfileSchema`
   (`src/lib/validation/coach-profile.ts`) — `weightKg`/`heightCm`/`age`
   changed from optional to required numbers; `CoachProfileInput`
   (`coach-profile.ts`) same; the API route
   (`api/member/coach-profile/route.ts`) drops its `?? null` fallbacks;
   `coach-onboarding-form.tsx` step 5's `canAdvance` now requires all
   three fields non-empty before Continue enables, and its copy changed
   from "Optional — helps personalise your plan further" to "Needed to
   work out your daily energy needs once nutrition guidance is
   available."
2. **Exercise images required a tap; Carl asked for automatic motion.**
   `workout-view.tsx` gained an auto-loop `useEffect` (900ms interval,
   swaps between the two frames, restarts cleanly on exercise change,
   only runs during the `"active"` phase) so the demonstration reads as
   continuous motion without requiring interaction — the manual tap
   still works as a fallback, the caption prompting it was removed.
3. **No technique/safety guidance per exercise.** Added a `safetyTip`
   field to every `CatalogExercise` entry — hardcoded, human-reviewed
   text, deliberately never LLM-generated, same non-negotiable principle
   already applied to RPE-driven weight progression (`generate-workout.ts`):
   nothing carrying real physical injury risk gets left to an LLM to
   improvise. Rendered under the image on the active-exercise screen via
   a new `getSafetyTip(key)` helper.

**Verified live end-to-end**, a fourth throwaway member walked through
onboarding → booking → workout: Continue on onboarding step 5 correctly
stayed disabled until weight/height/age were all filled, then enabled;
the exercise image visibly auto-switched between start/end position
across two screenshots one second apart with no click; the correct
safety tip ("Keep your chest up and core braced. Push through your heels
and don't let your knees cave inward.") rendered under the Barbell Squat
image. Test member/booking/session data deleted after.
`npx tsc --noEmit`, `eslint`, `npx vitest run` (24/24 passing), and
`next build` all passed clean on this final pass too.

This closes out the full 5-stage Hove AI Coach trial beta plan.
