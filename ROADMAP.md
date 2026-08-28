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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-36.md`, covering the pilot
mechanism proof (2026-08-05) through "Blank first-time exercise weight"
(2026-08-27) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Exercise photos filled in + 18 more
free-weight exercises" (2026-08-28). If this file grows too large again,
split it the same way: move the most clearly finished section into
`ROADMAP-ARCHIVE-37.md`, update this paragraph.

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

## Weekly check-in: data review + AI narrative + reflection questions — 2026-08-28

Stage 10b's honest "reflection questions coming soon" stub (2026-08-23)
became the real thing. Carl asked for a "reviewing your data" ceremony
ahead of the questions — total steps/workouts/volume lifted, days
nutrition logged, avg heart rate, avg sleep, then the AI coach gives a
detailed performance review, before the reflection questions.

**Scoped two real ambiguities before building**: "total amount lifted
overall" turned out to mean this week's total (matching every other
stat in the review), not true all-time-ever — confirmed with Carl rather
than assumed. And the new data-review screen comes *before* the
reflection questions, not instead of them.

**weekly-review.ts**: added `totalSteps`/`avgRestingHeartRate`/
`avgSleepMinutes` from `member_wearable_data` (a plain `date` column,
so a direct string-range comparison, unlike the `workout_sessions`/
`food_log_entries` queries which need London-midnight UTC-window
conversion). Null (not 0) when nothing's synced for the window — same
honest-gap convention nutrition's own averages already use.

**coach-bot.ts**: `narrateWeeklyReview()` — same Groq-then-Claude-Haiku
provider fallback and narrate-the-numbers-don't-compute-them boundary as
`narrateSessionIntro`/`narratePostSession`, but its own longer system
prompt (3-5 sentences, not 1-2) since this is the one narration a member
actually reads deliberately rather than in passing.

**checkin route**: the AI narrative only generates when the check-in is
actually due/overdue, not for the "N days to go" preview — no LLM spend
for a page nobody's checking in on. Best-effort try/catch, matches every
other coach-bot call site.

**checkin-view.tsx**: due/overdue flow now shows a brief "Reviewing your
data" spinner beat (the data's already back from the fetch by the time
it clears — a deliberate held beat, not a real wait), then the expanded
stats (new wearable cards individually omitted per-metric when unsynced,
not a blanket hide), the AI review, then 4 reflection questions —
5-point week-feel scale, pain yes/no with a conditional detail field,
and two optional free-text prompts (barriers, next-week focus). Answers
post to `check_ins.answers` — deliberately schemaless jsonb since 0054,
specifically because "the actual check-in question set isn't decided
yet" was true until this session, so no migration was needed now that it
is. `complete` route validates the payload with zod first.

**AI-generated demo photos considered and declined, separately**: Carl
asked about generating on-brand exercise-demo visuals with AI. Flagged
that this app's own rule — safety-critical technique guidance is
human-written, never LLM-generated, because bad form guidance risks real
injury — applies at least as strongly to a *photo* of "correct form" as
to a sentence, and image models are unreliable at consistent anatomy.
Offered black-and-white icon pictograms as a lower-risk on-brand
alternative; that path needs a `GEMINI_API_KEY` this environment doesn't
have, so the current stock photos stay for now.

**Verified live**, not just build-clean: backdated the test account's
`coach_profiles.created_at` by a week (with Carl's go-ahead) to force
the overdue state, since the account's real due date is 2026-08-30.
Confirmed live: overdue banner, ceremony spinner, all stat cards
(sessions/volume/nutrition — steps/HR/sleep cards correctly didn't
render, since this test account has no wearable connected), a real
Groq-generated review narrative that stayed honest about zero activity
rather than inventing praise, the pain-detail field's conditional
reveal, submit → `check_ins` row confirmed via direct DB read with the
exact answers entered, and the page correctly flipping back to "2 days
to go" afterward. Backdated timestamp and the test check-in row were
both cleaned up immediately after. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (105/105), and `next build` all clean throughout.

**Same-day follow-up**: Carl asked about the wider legal picture for
collecting health data (steps/HR/sleep/pain) — flagged that this is UK
GDPR special-category data (Article 9), that no privacy policy document
actually exists in either repo despite `terms-and-conditions.ts`
referencing one, and specifically that `narrateWeeklyReview` sending
real wearable figures to Groq (a US processor) is an international
transfer with no safeguards in place yet. Fixed the concrete part
immediately, for free: steps/avgRestingHeartRate/avgSleepMinutes removed
from the LLM prompt entirely — the member still sees them on screen,
computed and rendered with no LLM involved, only the narration text lost
access to them. Sessions/volume/nutrition stay in the prompt (same
category already sent via `narrateSessionIntro`/`narratePostSession`
before today, not new exposure). The paperwork side (privacy policy,
DPIA, consent flow, DPO-or-not decision) is still fully open — Carl
pushed back hard on solicitor cost; landed on: free ICO-template-based
drafting first (offered, not yet started), fixed-fee review after, DPO
question deferred until scale/requirement is actually confirmed.

**Same-day follow-up 2**: Carl proposed routing wearable questions
through the check-in chat itself (member types "6 hours" in response to
a Groq-asked question) as a way to avoid the international-transfer
issue, reasoning the member would be sending their own data. Corrected:
GDPR obligations attach to whoever built/controls the processing
pipeline, not to who physically typed the value — My Fit Pod choosing to
route the question through its own Groq integration is still My Fit
Pod's transfer, and freeform chat answers risk volunteering *more*
sensitive detail than a computed field, not less. Also asked "won't
their wearable's own app already show them this anyway" — true, but
irrelevant: GDPR attaches to what *this app* independently does with its
own copy of the data, regardless of what the device's own app shows.

Landed on and built the actual fix instead: `getWearableWeeklyReflection`
(`weekly-wearable-reflection.ts`) — reuses `recovery-signal.ts`'s exact
trailing-baseline pattern and thresholds (`RECOVERY_RESTING_HR_DELTA`/
`RECOVERY_SLEEP_MINUTES_DELTA`/`RECOVERY_MIN_BASELINE_DAYS`), just
week-scoped instead of day-scoped, paired with pre-written (not
AI-generated) copy — zero network calls, zero health data reaching any
third party. `getWearableSnapshotsBefore` (`wearables.ts`) fetches the
baseline bounded by the check-in's own `period_start`, not "today", so
a check-in completed mid-grace-window never pulls its own period into
its baseline. 9 new tests mirroring `recovery-signal.test.ts`'s exact
shape. Live-checked against the real connected test account (member
123, Carl's own) — correctly renders nothing yet, since real wearable
history there is only 3-4 days old against a 5-day minimum baseline;
confirmed via console (no errors) and a backdated-then-restored overdue
check-in, same procedure as earlier in the session.

**Real bug found and fixed in the process**: checking the real connected
account surfaced that `sleep_minutes` had been `null` for every synced
day — `google-health.ts`'s `SLEEP_NOT_YET_SUPPORTED` flag, an honest,
documented gap from 2026-08-24 (`dailyRollUp` has no sleep field; sleep
is session-based, needs a different endpoint). Implemented properly
against Google's real discovery document (`health.googleapis.com/
$discovery/rest?version=v4`), not guessed, matching this file's own
established standard for this API: `dataTypes.dataPoints.list` on the
`sleep` data type, filtered on `sleep.interval.civil_end_time`
specifically — confirmed sleep is the one session type Google documents
as filtered by interval *end* rather than start, since a sleep session
commonly spans midnight. Each result's `sleep.summary.minutesAsleep` is
already computed server-side by Google (no manual SleepStage-summing
needed, despite the original comment's assumption); summed across every
data point returned per day. `sleep.readonly` scope was already granted
at connect time, so no reconnect needed. **Verified live**: the existing
member-facing "Refresh" button (`/api/wearables/fitbit/refresh` — this
was already a separate, session-authenticated, today-scoped endpoint
distinct from the cron; no new button needed, Carl just hadn't clicked
it since the fix shipped) pulled real sleep data (7h 7m) through
immediately, confirmed both on-screen and via a direct `member_wearable_data`
read (`sleep_minutes: 427`).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (114/114,
9 new), and `next build` all clean throughout. Sleep sync confirmed
against a real live Google Health response, not just build-clean.
