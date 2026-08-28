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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-37.md`, covering the pilot
mechanism proof (2026-08-05) through "Exercise photos filled in + 18
more free-weight exercises" (2026-08-28) — all split out to keep this
file within Claude Code's ~15,000-character `@`-import limit. Archives
aren't always the strictly oldest material — the split point is "what's
finished and stable" as much as "what's oldest" (see each archive's own
header note for examples). Reference-only, not auto-loaded by CLAUDE.md;
check them for full build history, or `git log` on this file for exact
split points. Active content here starts at "Weekly check-in: data
review + AI narrative + reflection questions" (2026-08-28). If this file
grows too large again, split it the same way: move the most clearly
finished section into `ROADMAP-ARCHIVE-38.md`, update this paragraph.

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

## Health page redesign: one card per metric + weekly/monthly averages — 2026-08-28

Carl: the Connection card's flat 2x2 grid (steps/sleep/RHR/HRV) and each
metric's own expandable trend card below it were showing the same four
numbers twice — wanted the top grid gone, one card per metric, each with
a weekly and monthly average. Connection card (`wearable-connection-card.tsx`)
is status-only now: connect/refresh/disconnect plus a "last synced"
line, no more duplicate stats. Every metric — Steps, Sleep, Resting
heart rate, HRV — gets exactly one card. Sleep got a real trend card for
the first time (`formatAs="duration"` on `HealthMetricCard`), replacing
what had been a static "not available" placeholder until the sleep-sync
fix earlier the same session.

`averageInWindow` (`wearable-averages.ts`) — a pure, tested function
computing a 7-day/30-day average over already-fetched trend points,
London-calendar-dated (`londonDateString`/`addLondonDays`) same as every
other day-window calc in this app rather than a naive UTC subtraction.
`getRecentWearableSnapshots`'s fetch window widened from 14 to 35 days
so the 30-day average has real range to compute from. 6 new tests.

**Shipped a real production crash, caught and fixed live**: the first
version passed `format={formatSleepDuration}` — a plain function — from
`health/page.tsx` (a Server Component) into `HealthMetricCard`
("use client"). Next.js can't serialize a function across that
boundary; the failure surfaces in production as an unhelpful generic
error (minified React #441, "error occurred in the Server Components
render"), not a clear message. Neither `tsc` nor `next build` catch this
at all — it's a Next.js RSC runtime constraint, not a TypeScript type
error, so the first deploy looked completely clean by every automated
check and then crashed the live page. Caught only by actually loading
the deployed page rather than trusting green checks. Fixed by replacing
the function prop with a string flag (`formatAs: "duration"`) that
`HealthMetricCard` resolves to its own local formatter — safely
serializable, same visual result.

**Verified live** (both the redesign and the fix): all four cards
render correctly against the real connected account with real averages
(steps 7-day/30-day both 21,438 given only 3 real days of history;
sleep "7h 7m" for both windows; RHR 61bpm; HRV correctly showing "—",
no data at all yet), the Steps card's trend expand/collapse still
works, and the browser console is clean. `npx tsc --noEmit`, `eslint`,
`npx vitest run` (120/120, 6 new), and `next build` all clean throughout
(worth noting again: none of those caught the actual bug that shipped).
