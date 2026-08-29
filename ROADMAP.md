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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-39.md`, covering the pilot
mechanism proof (2026-08-05) through "Health page redesign" (2026-08-28)
— all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. Archives aren't always the strictly oldest material —
the split point is "what's finished and stable" as much as "what's
oldest" (see each archive's own header note for examples). Reference-only,
not auto-loaded by CLAUDE.md; check them for full build history, or `git
log` on this file for exact split points. Active content here starts at
"Persistent weekly habit + streak" (2026-08-28). If this file grows too
large again, split it the same way: move the most clearly finished
section into `ROADMAP-ARCHIVE-40.md`, update this paragraph.

## Persistent weekly habit + streak, feeding the Coach recommendation — 2026-08-28

Carl asked for a 5th check-in question ("What's one habit that's going
to push you forwards this week?") and then, mid-build, whether it
should feed "the member's main effort" — the existing `getWeeklyRecommendation`
"This week's focus" card on the Coach tab (2026-08-25), previously
100% system-derived, never member input.

**Scoped the priority placement before building**: confirmed with Carl
that the member's stated habit sits below the existing `prioritise_sleep`
recovery/safety flag (a live signal from this week's real data must
never be silently replaced by a self-statement made possibly days
earlier — same principle checkin-state.ts and the exercise catalog's
injury filtering already hold) but above the generic nutrition/protein
nudges. `hit_sessions`/`prioritise_sleep`'s own existing relative order
was left untouched — only the new `member_habit` tier was inserted, no
unrelated reordering.

Replaced the vague, optional "one thing to focus on next week?" (low
real usage, and now redundant) with the new required habit question —
required because an empty habit would silently break both the
recommendation feed and the new streak.

**New "Your habit" card** (`member-habit-card.tsx`) on the Coach tab,
always visible, showing the current commitment plus a streak.
`habit-streak.ts`'s `computeHabitStreak` — pure, tested — counts
consecutive weeks (no skipped period, non-empty habit) back from the
most recent check-in. Deliberately "weeks running you've SET a habit",
not "weeks you actually kept it up" — no self-report mechanism exists
to verify the latter, and this app doesn't claim what it can't back
(same principle as recovery-signal.ts never inventing a number).

**Carl then floated a much bigger, different feature** mid-build — a
daily habit checklist (water/steps/fruit etc.), member-set and/or
goal-based recommended habits, a Coach-tab layout with nutrition/workout
surfaced directly and check-in/leaderboard below, and questioned whether
training blocks are still needed. Correctly identified as a separate,
substantially larger project (new data model, new daily-tracking UI, a
real IA redesign, an actual architecture question) rather than an
extension of the single weekly habit — finished the smaller, already-
scoped piece first; the daily-habit-system idea is unstarted, needs its
own proper scoping pass.

**Verified live**, not just build-clean — and this time double-checked
after the Health-page deploy's crash lesson: confirmed the "Your habit"
card via `get_page_text` (a screenshot mid-deploy-propagation looked
like it was missing entirely; the DOM actually had it, just a rendering/
timing artifact in the screenshot, not a real bug). Full round-trip
tested on the real connected account: backdated `coach_profiles.created_at`
to force overdue, submitted a real check-in with a habit answer,
confirmed the exact row in `check_ins.answers`, confirmed "Your habit"
updated on the Coach tab with the correct "set this week" copy, and
confirmed "This week's focus" correctly still showed the higher-priority
`hit_sessions` nudge rather than the member's habit (proving the
priority chain works as designed) — then cleaned up both the backdated
timestamp and the test check-in row. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (134/134, 14 new), and `next build` all clean throughout.

## Daily-habit-system scoping session + two concrete fixes — 2026-08-28

Carl floated a much bigger idea mid-build on the weekly habit: a daily
habit checklist (water/steps/fruit etc., check-off plus counted
targets), member-set and/or goal-recommended habits, and a Dashboard/
Coach layout rework. Scoped via questions rather than guessed:
check-off+counted mix confirmed, coexists with (doesn't replace) the
weekly "Your habit" card, lands as a Dashboard card near the top. The
full recommended-habit catalog and exact daily-tracking data model are
still open — this was scoping, not yet a build.

Two concrete, already-clear items got built and shipped in the same
pass rather than waiting:

**Hypertrophy rep-target correction**: Carl — "when I said between
10-12 reps I didn't mean 11 reps." `REP_TARGET_BY_BLOCK_PHASE.hypertrophy`
was literally the midpoint of each stated range (`[7, 11, 17]`) — not a
number anyone programs. Confirmed the new values aren't a smooth curve
before changing anything (12 → 6 → 15, a heavier/lower-rep *middle*
phase, deliberately not ascending) and confirmed weight computation has
no hidden coupling to rep target (purely RPE-history-driven) before
shipping. Also fixed stale `~10-12 reps`-style copy in the training-block
API route that would have drifted from the real generated numbers.

**Dashboard training-block card removed**: turned out `/training`'s own
"Current training block" section already showed the full phase/rep
detail — Dashboard's small summary was a pure duplicate, not a
different view, so "move it to Training" was really "delete the
Dashboard copy."

**Still open, not built**: showing upcoming workout content before a
member books a session ("Next session" on `/training` currently only
shows anything once a booking exists) — real mechanism choice between
eagerly generating the A/B/C template set at phase start vs. a read-only
preview computed on demand, not decided yet. And the full daily-habit
checklist itself.

**Verified live** (not just build-clean, per the Health-page crash
lesson): both fixes confirmed on the real deployed site — Dashboard's
training-block card gone, `/training` showing "Phase 2 of 3 · Weeks 5-8
— 6 reps" (the corrected value). `npx tsc --noEmit`, `eslint`,
`npx vitest run` (134/134), and `next build` all clean throughout.

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
