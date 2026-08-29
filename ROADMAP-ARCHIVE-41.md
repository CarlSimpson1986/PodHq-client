# Archive 41 — Nutrition activity level, Stage 3 workout choice, exercise video library (2026-08-29)

Split out 2026-08-29 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, finished and
verified live. Reference-only, not `@`-included anywhere.

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
