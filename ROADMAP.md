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

**Older history has been split into numbered archive files** —
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-40.md`, covering the pilot
mechanism proof (2026-08-05) through the daily-habit-system scoping
session (2026-08-28) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see each archive's own header note
for examples). Reference-only, not auto-loaded by CLAUDE.md; check them
for full build history, or `git log` on this file for exact split
points. Active content here starts at "Nutrition activity level..."
(2026-08-29). If this file grows too large again, split it the same
way: move the most clearly finished section into `ROADMAP-ARCHIVE-41.md`,
update this paragraph.

## Nutrition activity level, two live bugs, Stage 3 workout choice, and a ~95-exercise video library — 2026-08-29

Long session, several distinct pieces, all live-verified via the
playground member (dev server + real Supabase, not just build-clean).

**Two live bugs found and fixed by clicking around**: `MemberHabitCard`
was a plain `<div>` sitting directly above the real `<Link>`-wrapped
Check-in card, same `card-light` styling — looked identically tappable,
had no `onClick`/`Link` at all. Now links to `/coach/checkin`, same
destination as Check-in (habit has no separate edit screen). Separately,
`CoachChatView`'s message list had no bounded height (`min-h-[60vh]`, no
`max-h`, missing `min-h-0` on the flex child overflow needs) — every
message ever sent pushed the whole `/coach` page taller instead of
scrolling. Fixed with `max-h-[70vh]` + `min-h-0`; confirmed live with a
real 3-exchange conversation showing a proper internal scrollbar.

**Nutrition — daily activity level, decoupled from training.** Carl
wanted an occupational-activity input ("does someone doing heavy manual
labour need more calories than an office worker") — the gap: TDEE's
activity multiplier was derived purely from `sessions_per_week`, which
has no sedentary tier and conflates training frequency with daily-life
activity. New `daily_activity_level` field (migration `0069`, podHq)
with 5 occupation-only tiers (no exercise wording, to avoid double-
counting). First design used `sessions_per_week` as an *additive*
MET-based exercise-calorie term on top — Carl rejected it: "session per
week is more for programming... training doesn't burn that much
energy," and eating-back exercise calories is a known way people
undermine a deficit. Simplified to the daily-activity multiplier alone;
`sessions_per_week` now has **zero** calorie contribution, confirmed by
an explicit regression test. BMR also swapped Harris-Benedict →
Mifflin-St Jeor (more accurate per current literature, flagged in the
file's own prior comment). Live-verified: real computed target (3,090
kcal / 149g protein / 411g carbs / 94g fat) matched hand-calculated
values exactly for the playground member's actual profile.

**Stage 3 — split-day / build-your-own workout**, the piece paused back
in the A/B/C rotation session. `WorkoutView` no longer auto-generates on
mount; a new "choose" phase offers **Today's session** (unchanged),
**Focus day** (pick 1-2 of the 6 muscle groups, `pickFocusExercises`
round-robins up to 6 exercises across them), or **Build your own** (new
`GET /api/member/workout/eligible-exercises` endpoint feeds a picker,
server re-validates any submitted keys against live injury/equipment
exclusions same as `swapExercise` already does). Both non-default modes
leave `template_id` null so an off-plan day never consumes/skips the
member's A/B/C rotation slot — confirmed directly against
`workout_sessions` rows, not just code inspection. Live-verified full
round trip for both modes with real generated sessions.

**Exercise video library — the big one.** Carl found Unbroken Fitness
Solutions' YouTube channel (real personal-training business, short
~20-50s demo clips organized into per-equipment "Movement Library"
playlists) and wanted real technique videos instead of the static photo
pairs. Built a repeatable workflow rather than picking blind: scrape a
playlist (paginated `ytLockupMetadataViewModelTitle` DOM extraction,
scroll-to-load-all, dedupe by exact-title match — each round found 1-3
genuine re-shoot duplicates), publish a tickable checklist Artifact
(search/preview/copy-selected-to-clipboard), Carl ticks what he wants,
pastes the list back. Ran this four times — dumbbell (34 picks),
barbell (15), cables (20), kettlebell (13) — landing 82 real videos
across 62 catalog entries (36 attached to existing exercises, 46 new
ones added, catalog now 95 exercises total). New entries follow the
established DRAFT-safety-tip convention, not yet Carl-reviewed.

Real decisions made along the way, not just mechanical attachment:
- **Legal**: embedding via YouTube's own player (not downloading/
  re-hosting) is the standard low-risk path — the creator's own choice
  per video whether embedding is even allowed. Carl's first instinct was
  to download and crop out a brand watermark that appears in each
  clip's last ~5 seconds — flagged clearly that downloading + stripping
  a watermark is a real DMCA-CMI/copyright risk (courts read watermark
  removal as evidence of *intentional* infringement), and that the same
  visual result is achievable legitimately via the embed's own `start`/
  `end` playback-window params. New `youtubeStartSeconds`/
  `youtubeEndSeconds` fields on `CatalogExercise`, threaded through
  `getYoutubeEmbedTiming()` into the iframe `src`. First cut computed
  `end` per-video as `(duration - 5)`; Carl's later call simplified to a
  flat 0-10 seconds for every clip regardless of length — batch-updated
  all 82 entries.
- **New equipment type**: kettlebell exercises needed a `kettlebells`
  `EQUIPMENT_TYPES` entry — the first time this catalog has gone beyond
  the original 4 categories. Added here and mirrored in podHq's
  `src/lib/data/types.ts` (+ its equipment-picker label), same
  cross-repo duplication convention as `GYM_NAMES`. Confirmed via a
  direct DB check that **every** `pod_resources` row (Aylesbury
  Berryfields, both Hove rows) was sitting at `equipment: []` — which
  this app's own filtering logic treats as *unrestricted*, not
  "unconfigured." Carl confirmed real equipment per gym (all 5
  categories, both gyms); updated all 3 rows to the explicit full list
  rather than leaving the accidental unrestricted-by-omission state.
- **Duplicate-name variants kept deliberately separate**: several
  exercises got ticked in both a plain and an "alternating"/grip-variant
  form (e.g. Bicep Curl + Alternating Bicep Curl, three different
  tricep-pushdown grips) — treated as Carl wanting both represented, not
  collapsed into one, so each became its own catalog entry rather than
  overwriting the plain version's video.

**Tooling note**: hit a genuine claude-in-chrome bug this session —
`computer` click coordinates were offset from screenshot coordinates on
this machine (screenshots rendered 1425×660, live viewport reported
1745×808), causing clicks to land one row below the intended target on
multi-row button grids. Confirmed via direct DOM state checks, not just
visual guessing. Workaround: drove all further interactions through
`element.click()` via `javascript_exec` instead of coordinate-based
dispatch. Also hit the PWA service worker serving a stale cached JS
bundle after a full dev-server restart + `.next` cache clear — new
catalog entries didn't show up in the picker until the service worker
was explicitly unregistered and its cache cleared per tab.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (142/142 —
3 tests had hardcoded catalog-key allowlists that needed updating for
the expansion, not real regressions), and `next build` all clean
throughout, in both repos where touched. Every piece live-tested against
the playground member (real bookings, real generated sessions, real
embedded videos with the correct `end` param confirmed via
`new URL(iframe.src)`), not just build-clean claims.
## Today's Mission on Home, daily habits, workout mode-swap redesign, always-visible workout preview, 50-min exercise-count budget — 2026-08-29

Picked up the unstarted daily-habit-system idea flagged in the entry
above. Built the daily habit checklist first: `member_habits`/
`habit_logs` (podHq migration `0070`, insert-only tick rows, "row
existence = happened" convention), full CRUD (`daily-habits.ts`,
`/api/member/habits/*`), `DailyHabitsCard` — recommended-list buttons
plus custom checkbox/counted-target entry.

Carl then floated a bigger idea mid-build — a "Today's Mission" card on
Home showing workout/steps/habits/nutrition for premium members,
reversing the documented "Home stays slim, Coach tab is the premium
space" policy in `ai-coach-section.tsx`. Confirmed the reversal
explicitly before building. `getTodaysMission` aggregates all four from
data that already existed (bookings/`workout_sessions` status, latest
wearable snapshot, habit tick counts, today's food log vs. nutrition
target) — no new tables. Shipped as a collapsed-by-default "x/4 today"
card (Carl's call — Home already stacks several cards) that expands to
the four status rows plus the habit checklist inline; habits moved from
`/dashboard` to live here instead, plus a management copy on
`/coach/profile` so a new premium member has somewhere to set habits up
before Home ever shows a populated list.

**Real dev-server bug, not a code bug**: `next dev --webpack` (pinned in
`package.json` since the repo's first commit, never a deliberate fix for
anything) crashed with "Element type is invalid. Received a promise that
resolves to: undefined" on this specific new nested-client-component
pattern (`TodaysMissionCard` rendering `DailyHabitsCard`, now shared
across two routes) — confirmed via a side-by-side Turbopack dev instance
on a different port showing zero errors. Fixed by switching `dev` to
plain `next dev` (Turbopack); `build` stays pinned to `--webpack`, so
production is unaffected either way. Also hit a real stale-HTTP-cache
issue after every dev-server restart — a normal refresh can still serve
an old JS chunk; only a genuine hard reload (Ctrl+Shift+R) reliably
clears it, confirmed repeatedly this session.

**"Change today's workout" replaces the Stage 3 pre-generation choose
screen** (Carl's call): every booking now generates the default A/B/C
plan immediately — no more upfront mode choice. The overview screen
gets a "Change today's workout" link (top of screen, per Carl's
feedback) behind a program-hopping warning, into the existing
focus/build-your-own pickers. New `changeWorkoutMode`/`hasSessionStarted`
in `workout-session.ts`: locked out once any set is logged, otherwise
deletes the unstarted session (no cascade delete on these FKs — manual
child-then-parent delete order) and regenerates in place via a
`generateAndPersistSession` helper extracted from `getOrCreateWorkoutSession`
so both callers share one implementation. New `/api/member/workout/
change-mode` route, same IDOR/validation shape as `/generate`.

**Always-visible workout preview** (`/training`'s new "Your workouts"
section, `getBlockWorkoutPreview`): the A/B/C template store
(`workout_templates`) already lived independent of bookings — this just
exposes it read-only, generating the phase's set eagerly if it doesn't
exist yet, with a "Today's pick" badge on whichever letter a real
booking would actually generate right now (same rotation math
`resolveTemplatedPlan` uses). Confirmed with Carl this stays read-only
(no logging without a real booking) before building the fully
interactive version he first asked for. Each workout is its own
tap-to-expand card; each exercise gets a tap-to-expand technique video
(no thumbnail image — CSP's `img-src` is locked to `'self' data:`, so a
live YouTube thumbnail would need a CSP change; a plain "▶ Watch" toggle
needs none, reusing the same `youtube-nocookie.com` embed the
active-exercise screen already uses). Home's Workout row now links here
instead of `/book` when nothing's scheduled.

**Real "how many exercises fit in 50 minutes" instead of a flat 4**
(Carl's call, worked through together): `computeExerciseCount` in
`generate-workout.ts` — set duration from rep target × ~3s/rep, rest
from Carl's own numbers (hypertrophy: 2min compound / 90s isolation;
strength: 3min / 2min, longer for heavier low-rep work; deload reuses
hypertrophy's numbers), blended 50/50 compound:isolation estimate
against a 50-minute (3000s) budget, floored at the original 4 so this
can only add exercises, never regress below what shipped before.
Replaces the old fixed `TEMPLATE_MUSCLE_GROUP_PLAN` (exactly 4
slots/letter) with an 8-entry priority list per letter (legs leads,
doubles up near the end, keeps the original 3-group-per-letter picks in
the middle) — real range is 5-11 depending on block/phase, clamped to 8
by the hand-authored list length for now. Same change flows through the
default booking path, the template preview, and the goal-based
fallback. Fixed 2 stale hardcoded equipment-allowlist tests that assumed
exactly 4 results (same "catalog outgrew the test's literal list"
pattern as an earlier session) — rewritten to derive the expected set
from the live catalog instead of a hand-typed list, so this class of
test doesn't go stale again on the next catalog or budget change.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (142/142, 2
rewritten), and `npm run build` (respects the `--webpack` pin) all clean
throughout. Live-verified against the playground member (id 134):
Today's Mission expand/tick/add, `/coach/profile` habits section,
`/training`'s workout count 4→8 after clearing that member's stale
phase templates, "Today's pick" badge, and the video toggle. Could not
live-click-test the "Change today's workout" swap itself — the
playground member has 0 booking credits; code-reviewed and
build/test-verified only.
