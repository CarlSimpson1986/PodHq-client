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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-66.md`, covering the pilot
mechanism proof (2026-08-05) through the pre-launch review (2026-09-07)
— all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. Archives aren't always the strictly oldest material —
the split point is "what's finished and stable" as much as "what's
oldest" (see each archive's own header note for examples).
Reference-only, not auto-loaded by CLAUDE.md; check them for full build
history, or `git log` on this file for exact split points. Active
content here starts at "Email branding" (2026-09-07). If this file grows
too large again, split it the same way: move the most clearly finished
section into `ROADMAP-ARCHIVE-67.md`, update this paragraph.

## Email branding, Android Play-prep fix, and the full rest-timer/session-timer/duration-feedback loop — 2026-09-07

Carl explicitly asked for this written up in full because he doesn't trust a chat summary alone — this entry is the source of record, including the one place a design got built wrong first and had to be corrected.

**Email branding** (`45fc5fb`) — `src/lib/notifications/templates.ts`'s one shared `emailShell()` (feeds every template: bookings, waitlist, credits-low, win-back) redesigned to use the app's real gold/near-black accent (`#c9a24b`/`#0a0a0b`, copied from `globals.css`'s own tokens) instead of a plain black bar with no accent colour, plus the app icon in the header. Every CTA button (`ctaButton()` helper) now uses that same pairing instead of plain black-on-white.

**Android geolocation fix** (`166bb34`) — `AndroidManifest.xml` declared only `INTERNET`; the door-unlock flow needs real GPS for its geofence check, so every unlock attempt in the native Android app would have silently failed with "Turn on location services," indistinguishable from location genuinely being off. Added `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`. Reasonably confident this is the complete fix (Capacitor's default `BridgeActivity` bridges WebView geolocation to Android's runtime permission system automatically), but **not yet confirmed on a real device or emulator** — do that before Play Store submission.

**Rest timer, made universal** (`aaad007`) — the existing rest-timer UI (countdown, "Skip rest", next-exercise preview) previously fired only for custom-built workouts with a member-set rest value. `REST_SECONDS_BY_BLOCK` (hypertrophy/strength/deload × compound/isolation) already existed but was only ever used to estimate session length, never actually applied — every AI-generated exercise now gets this as a real `restSeconds`. Real rest taken is captured (`workout_sets.rest_actual_seconds`, measured against `Date.now()` at rest-start/rest-end so a backgrounded tab can't under-report it via a throttled `setTimeout`) and feeds `computeRestSecondsForBlock()`: cut short + felt fine → shortened next time; cut short (or ran over) + felt hard → extended; on-target → held. `describeRestChangeReason()` explains it in the UI, same never-separately-invented-explanation rule as the existing weight-change reasoning. Threaded through `generateWorkout()`, `instantiateTemplate()`, and both exercise-swap paths.

**Overall session timer** — `workout_sessions.started_at` stamped server-side (`markSessionStarted()`) the first time a member enters the active workout, not `created_at` (plan-generation time, could be hours earlier). Shown on warmup/active/resting/cooldown screens, ticking from the real timestamp each second (never a flat increment, so it can't drift). Then extended further, per Carl mid-build: also stamped from a **successful door unlock** (`markSessionStartedByBookingId()`, called from `unlock/route.ts`), so the clock reflects when the member is genuinely in the pod, not whenever they happened to open the workout tab. Both `bookings-view.tsx` and `upcoming-session-card.tsx` now auto-navigate to `/workout/[bookingId]?justUnlocked=1` about a second after a successful unlock; that flag skips the AI intro-narration screen (nothing left for it to do — the member is already standing in the pod) and shows a one-time "Welcome, {first name} — here's your session for today" banner on the overview screen instead, landing exactly where the recovery/readiness-check content already lives.

**Duration feedback, and a real mid-build correction — worth recording honestly.** First pass: three buttons (Too long / Too short / Just right) on the session-complete screen, feeding `computeExerciseCount()` to add/remove a whole exercise next session. **Carl caught this as wrong before it shipped**: core compound lifts (bench press, rows, squats — whatever the block's rotation picked) must always stay and always keep progressing, so exercise count/identity is the wrong lever entirely. Reworked to the actual shipped design: `setsForExercise()` in `generate-workout.ts` only ever adjusts **accessory (`isCompound: false`) exercises' own set count** — too long → 2 sets next time, too short → 4, just right/no feedback → the standard 3 — while every compound exercise stays fixed at 3 (or `DELOAD_SETS_PER_EXERCISE` during a deload week, which takes priority over any feedback, verified explicitly in tests). `computeExerciseCount()` itself was reverted to exactly its pre-feature form. New `workout_sessions.duration_feedback` column, `submitDurationFeedback()`, and `POST /api/member/workout/[sessionId]/duration-feedback`.

**Confirmed already true, not new**: every adjustment in this app (recovery-based weight reduction, RPE progression, rest, now duration feedback) is a *default*, never a lock — the low-recovery banner has a real "No, keep as planned" dismiss button, and weight/reps fields stay freely editable regardless, so a member training through poor recovery and hitting a genuine PB was never blocked by any of this, before or after this session's changes.

**Verified**: `tsc --noEmit`, eslint (including two real fixes to match this file's own established async-effect/purity-disable conventions, not blind suppressions), the full test suite (205/205, up from 195 at the start of this session — added tests for the medical-emergency marker, help-bot, the rest-adjustment rule, and the corrected accessory-sets rule), and a production build all clean after every round. **Not yet verified live**: the actual door-unlock → auto-navigate → welcome-banner flow, and the Android permission fix, both need a real device/session to confirm end-to-end — everything above is "type-checks, tests, and builds correctly," not "watched it happen on a real phone."

**Explicitly scoped out, not started**: a decline-detection feature (3 consecutive sessions of falling weight/reps on a key lift → a direct check-in, "is everything ok, do we need a deload") and a "lock accessory sets for 4 weeks once dialled in" mechanism were discussed and agreed as sensible next steps, but neither is built. Both need real trend data this app doesn't currently expose — `getWorkoutHistory()` collapses each exercise down to a single "most recent" value; genuine decline-detection needs the last 3-4 real values per exercise, not a snapshot. Design this properly (including what "declining" precisely means and what a detected decline actually offers) before building, not bolted on ad hoc.

Migration `0093_workout_rest_intelligence.sql` (podHq, `17c2210` + a comment correction in `d5b6741`) applied live by Carl via Supabase's SQL Editor.

## Decline-detection — designed and approved, NOT YET BUILT — 2026-09-07

Carl stopped the session before any code was written ("stop... i am going to bed") — this is the approved plan, saved so it survives to the next session untouched. Went through Claude Code's plan mode properly this time (Explore agent for the real architecture, a clarifying `AskUserQuestion` round with Carl, a Plan agent to validate the rule, then written up and approved) rather than building straight into code the way earlier features this session did.

**Scope, per Carl's own decisions**: core compound lifts only (bench/rows/squats — whatever the block's rotation picked), not accessories; **message only for v1** — a check-in banner, no "start a deload" button yet; scientifically grounded, not an arbitrary number (Carl's own ask: "what does the science say?").

**The rule**: raw weight can't be compared across sessions here — this app's own rep target changes across a block's 4-week phase, so a lower weight at a lower rep target isn't decline. Fix: compare **estimated one-rep-max** instead (Epley: `e1RM = weight_actual_kg * (1 + reps_actual / 30)`). A falling e1RM alone still can't tell a member's own deliberate back-off from real overreaching — the standard distinguishing signal is perceived effort: intentional backing-off drops output *and* effort together, concerning decline shows output falling while effort holds or rises. Final rule: e1RM across the lift's **last 3 real appearances** (not calendar sessions — an A/B/C rotation means a lift doesn't run every session) is non-increasing overall with at least one genuine decrease (relaxed from a first-pass "strictly falling every step," which a Plan agent correctly flagged as too fragile against ordinary plate-rounding/rep noise) — AND the newest RPE isn't lower than the RPE from 2 appearances ago (missing RPE treated as "didn't ease off," erring toward showing the harmless dismissible banner over missing a real signal).

**Implementation plan** (full detail in `C:\Users\carls\.claude\plans\cached-nibbling-marshmallow.md`, but that's a local Claude Code file, not synced anywhere — this paragraph is the durable copy):
1. `coach-profile.ts` — new `ExerciseAppearance`/`ExerciseTrend` types; `getWorkoutHistory()` gains a `trends: ExerciseTrend[]` field (newest-first, capped at 4 appearances per exercise key), computed as a second reduction pass over the *same already-fetched* sessions/exercises/sets data — no new query, and `ExerciseHistoryEntry` itself stays untouched since every existing weight/rest consumer expects a single value.
2. `types.ts` — new `DECLINE_CHECK_HISTORY_LOOKBACK_SESSIONS = 15` (only the session-generation call site's `getWorkoutHistory` limit changes; `swapExercise`'s call stays at the default 6).
3. New `decline-detection.ts` — `estimateOneRepMax()`, `detectDecline(trend)` (the rule above), `findDeclineAlertExerciseKey(plan, trends)` (compound-only via `EXERCISE_CATALOG`, first qualifying match in plan order — a documented v1 simplification if two compounds decline at once).
4. `workout-session.ts` — `generateAndPersistSession` bumps its history-fetch limit, computes `declineAlertExerciseKey` after the plan is built, writes it to a new `workout_sessions.decline_alert_exercise_key` column at insert time (same "computed once, persisted" pattern as `weight_change_reason`).
5. New podHq migration `0094_workout_decline_check.sql` — one nullable text column, no CHECK constraint, same conventions as every prior migration this session. **Not yet written or applied.**
6. `loadSessionDetail`/`WorkoutSessionDetail` thread the new field through.
7. `workout-view.tsx` — reuses the existing low-recovery banner's exact visual/dismiss pattern. Copy: *"Your {exercise name} has dropped the last 3 times you did it — everything ok? Might be worth a deload week."* One "Got it" dismiss button, no second action.
8. New `decline-detection.test.ts` — 11 planned cases (genuine decline, decline-but-RPE-also-eased-off, too little history, an up-tick resetting the signal, a rep-target change that actually raises e1RM despite lower weight, a flat tie still counting as non-increasing, missing-RPE still flagging, accessory never flagged, first-compound-wins, formula spot-check).

**Nothing built yet** — no files touched beyond reading them during planning. Next session: implement exactly this plan (steps 1-8 above), verify with `tsc`/eslint/`vitest run`/`npm run build`, then Carl applies the migration live and confirms the banner behaves correctly against a real declining trend before it ships.
