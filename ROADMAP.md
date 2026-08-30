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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-47.md`, covering the pilot
mechanism proof (2026-08-05) through the weekly-check-in rebuild
(2026-08-30) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Stage 4 of custom workouts" (2026-08-30).
If this file grows too large again, split it the same way: move the
most clearly finished section into `ROADMAP-ARCHIVE-48.md`, update this
paragraph.

## Stage 4 of custom workouts — HIIT interval timer + reps tally — 2026-08-30

Fourth Cardio sub-format alongside AMRAP/RFT: a real work/rest interval
timer (member sets work seconds, rest seconds, round count, rest-between-
rounds seconds; the app cycles through the picked exercises automatically).
Migration `0074_workout_hiit.sql` (podHq, shared DB) adds only
`work_seconds`/`rest_seconds`/`rest_between_rounds_seconds` — reuses
`target_rounds`/`rounds_completed`/`elapsed_seconds` from AMRAP/RFT
unchanged. v1 has no early-exit/DNF (always completes every prescribed
round), so completion needed no self-report at all — a plain "I finished"
POST, server-computes `elapsed_seconds` from the stored prescription,
never trusts the client.

The sequencer (`workout-view.tsx`) is a small state machine — round,
exercise index, sub-phase (work/rest/rest-between-rounds) — ticked every
second via `setTimeout`, same pattern AMRAP/RFT's own timers use. Hit
`react-hooks/set-state-in-effect` when every branch's setState ran
synchronously in the effect body; fixed by moving the whole transition
into the same `setTimeout` callback as the 1s tick (0ms delay when a
transition is due immediately) rather than calling it inline.

**Reps tally, added same day** after Carl asked "would you not want to
track how many of each you did in the 30s?" — HIIT's auto-completion
gave a member nothing to look back on. New optional post-completion
screen (never blocks or delays the automatic completion above) logs one
number per exercise into `workout_sets.reps_actual` — the same column
every other format already uses, no new schema.

**Found and fixed along the way**: the "Start" button on a *resumed*
HIIT session (one generated in an earlier page load) wasn't syncing
`hiitWorkSeconds`/`hiitRestSeconds`/`hiitRounds`/`hiitRestBetweenRoundsSeconds`
from the server — it silently ran the component's useState defaults
(30/15/4/30) instead of what was actually generated. Now seeded from
`detail` on every Start tap, not just the one where the builder was used
in the same render.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean throughout. Live-verified twice on the
playground member/booking — full work→rest→work→rest-between-rounds→
next-round cycling, terminal auto-completion, and the reps-tally screen
(one exercise logged, one left blank, confirmed both the DB write and
the "skip if blank" behaviour). The first live-test attempt appeared to
skip the tally screen entirely; root cause was a stale service-worker
cache serving pre-tally JS, not a code bug — confirmed by diffing the
actual served chunk against source, then reproduced correctly after
clearing the SW/cache.

**Not built this stage**: pause/skip/early-exit; per-exercise weight;
warm-up/cool-down toggle for HIIT (matches AMRAP/RFT's own omissions).

## Weekly weigh-in + body measurements — 2026-08-30

Carl asked whether the app tracked body weight over time — it didn't;
`coach_profiles.weight_kg` was a single current value, fully overwritten
on every profile edit with no history. New `member_body_measurements`
table (migration `0075`, podHq, shared DB) — `weight_kg`/`waist_cm`/
`hip_cm`, all nullable, unique on `member_id, recorded_date`. Deliberately
NOT part of `member_wearable_data`: that table is fully deleted the
moment a member disconnects their wearable (right-to-erasure behaviour),
which would silently wipe manually-entered measurements too.

Logged as an optional step in the existing weekly check-in (Carl's
choice — weekly cadence, not an always-available action, matching this
app's existing pattern for reflective data and avoiding encouraging
daily weigh-ins). A logged weight also syncs into
`coach_profiles.weight_kg` via a new targeted partial-update
(`updateProfileWeightKg`) — `nutrition-targets.ts`'s TDEE calculation
already reads that column live on every call, so nutrition targets pick
up a new weigh-in with zero extra wiring. Trend charts (reusing the
existing `HealthTrendLine` component) show on `/coach/profile`, next to
the weight field, one per metric, hidden entirely until that metric has
at least one logged point.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean. Live-verified on the playground member: a
real check-in submission (backdated the previous check-in row 8 days to
force "due" state for testing) with weight logged and waist/hip left
blank — confirmed the `member_body_measurements` row, the
`coach_profiles.weight_kg` sync, the profile form reflecting the new
value, and the weight trend card rendering correctly with waist/hip
cards absent (no data logged for either).

**Not built this stage**: an always-available "log anytime" entry point
outside the weekly check-in; a computed waist-to-hip ratio or any
health-risk interpretation — this is logging + a trend line, not
analysis.

## Session history + workout stats — 2026-08-30

Carl asked for a way to browse past sessions, then "what about workout
stats?" — there was genuinely no session-history browsing anywhere
(only the single "Last Session" card, always the most recent one) and no
lifetime/recent totals at all. Also surfaced a dead function
(`getRecentCompletedSessions`) clearly built for exactly this and never
wired up.

New `/training/history` — a stats summary (sessions completed, total
volume, per-format breakdown, last 26 weeks — matches the `WEEKS_WINDOW`
convention every other aggregate function in this codebase already uses,
sidesteps unbounded pagination past PostgREST's 1000-row cap) above a
capped last-20 list, each row linking to `/training/history/[sessionId]`.
Reused and fixed the dead function (renamed `getSessionHistory`, made
format-aware) rather than writing a third "list of sessions" query.

**Found and fixed along the way**: `LastSessionFormat` was missing
`"hiit"` from its union (the DB column could hold it regardless), and
the Last Session card's non-straight-sets branch only ever rendered the
prescription (`repsTarget`/`weightTargetKg`), never what was actually
logged (`repsActual`/`weightActualKg`) — so a HIIT session was
mislabeled "Rounds For Time" and always showed "— reps" even after a
member logged reps via the same day's new tally screen. Extracted the
fixed rendering into a shared `SessionDetailView` component so both the
Last Session card and the new detail page render through one place, not
two copies.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean — no new migration, every field already
existed. Live-verified on the playground member: `/training`'s Last
Session card now correctly reads "HIIT — 2 rounds in 0:26" with "Burpee:
8 reps"; `/training/history` showed the correct stats summary (38
sessions, 108,952kg, format breakdown) and list; tapped into both a HIIT
row and a straight-sets row, confirmed both render correctly with no
regression to the existing straight-sets RPE-badge display.

**Not built this stage**: pagination past the last 20 sessions; editing/
deleting a past session; a stats page independent of the history list.

## Cardio equipment logging — 2026-08-30

Scoped 2026-08-29, never built until Carl asked "cardio wise — I can add
that via the UI right?" — confirmed nothing existed on either side.
Gym staff name individual machines on podHq's `/setup` (new
`gym_cardio_equipment` table, `0076` shared DB, owner-editable with
admin fallback, mirrors the pricing catalog's exact pattern —
soft-disable not delete, so history stays meaningful). Members log which
one they used as a 5th row on Today's Mission ("2/5 today" →
"3/5 today" etc.), tapping through to `/cardio-log`, a plain named-button
list; `member_cardio_logs` is insert-only, same convention `habit_logs`
already established (no stateful "completed" flag, "done today" is
`count(*) > 0`). Binary log only, no duration/distance this stage —
matches Carl's own framing ("counts toward missions"), not a fitness
tracker.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean in both repos. Live-verified end to end on the
Aylesbury Berryfields gym: added Treadmill 1 + Rower 1 on `/setup`,
disabled Treadmill 1, confirmed podhq-client's picker showed only Rower
1; logged it, confirmed the Today's Mission Cardio row flipped to
"Logged" and the `member_cardio_logs` row matched exactly. Hit and
resolved an incidental blocker: the playground member's browser session
had expired mid-test with no stored password — reset it via the same
service-role script pattern podHq already has for its own pilot account.

**Not built this stage**: duration/distance tracking; cross-gym equipment
visibility for members training at a different network gym; equipment
type/category taxonomy.

## PubMed citations made independently verifiable — 2026-08-30

Carl asked how anyone could check the AI Coach's PubMed citations were
correct — until now the model was only *instructed* not to invent one
(`coach-chat.ts`'s system prompt), with no technical backstop and nothing
in the UI a member or Carl could actually click to verify.

**Model now tags every real citation with its PMID**, copied verbatim
from `search_pubmed`'s own tool output (which already prefixed each
result with `[PMID n]` — the model just wasn't asked to echo it back).
**Server-side backstop, not just a prompt change**: `pubmed.ts` gained
`extractCitedPmids()` (reads the real PMIDs out of a formatted tool
result) and `sanitizeCitedPmids()` (strips any `[PMID n]` tag in the
model's reply that isn't in that set). Both `askGroq` and `askClaude`
now accumulate a `knownPmids` set from every `search_pubmed` call made
that turn and run the final reply through the sanitizer before
returning it — a hallucinated PMID degrades to an unlinked sentence
(same as before this stage), never a fake-but-clickable citation.

**UI renders the tag as a real link** (`coach-chat-view.tsx`): assistant
messages are split on the `[PMID n]` pattern and each match becomes an
`<a href="https://pubmed.ncbi.nlm.nih.gov/{n}/">` — one tap confirms the
study is real.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (178/178, +6 new
for `extractCitedPmids`/`sanitizeCitedPmids` covering the known/unknown/
empty-set cases), and `npm run build` all clean. Live-tested against the
real Groq + PubMed APIs in local dev (not the deployed preview) with
debug logging temporarily added and removed after: a no-results query
correctly produced no citation and no tag; a real query returned 5 real
PMIDs and the model's reply cited `[PMID 35986981]` — a genuine 2022
*Nutrition* meta-analysis actually in that result set — which rendered
as a working link in the UI. Also root-caused why two earlier live tests
that session had shown citations with no PMID tag at all: they'd hit a
dev server process still running the pre-edit code (Turbopack doesn't
always hot-reload a `server-only` lib change for an API route) — killing
and restarting it fixed it, consistent with prior stale-bundle issues
this project has hit before.

**Not built this stage**: no check that the citation's *claim* (not just
the PMID) accurately reflects the abstract — the sanitizer guarantees
the PMID is real, not that the summary is a faithful one; that still
needs an occasional human spot-check.
