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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-65.md`, covering the pilot
mechanism proof (2026-08-05) through three competitor-gap features
(2026-09-06) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Pre-launch review" (2026-09-07). If this
file grows too large again, split it the same way: move the most clearly
finished section into `ROADMAP-ARCHIVE-66.md`, update this paragraph.

## Pre-launch review — 4-domain audit, real bugs fixed, adversarial eval suite built — 2026-09-07

Carl: "act as a senior end to end developer, give me a full review of the
pod-client app and highlight anything that is an issue prior to going
live." Split into four parallel investigations (security/auth, payments/
concurrency, physical-access/data-privacy, chat-safety/code-quality), each
told to verify every claim against current code, not against what this
ROADMAP says was already fixed. Physical-access/data-privacy and
security/auth both came back clean (session validation, RLS-as-auth
anti-pattern absent, the Stripe-account-routing fix from the 2026-09-05
wargaming session confirmed complete on every call site, IDOR checks
consistent everywhere) — only low-severity findings there. Payments/
concurrency and chat-safety/code-quality found the real gaps below.

**Fixed — chat safety.** Crisis detection covered suicide/self-harm only;
a message like "chest feels tight, can't breathe" fell through to the
ordinary pain carve-out, dangerously weak for a possible cardiac event
with no staff backstop (pods are unmanned). Added a second fixed-reply
marker/pair to `crisis-response.ts` (`MEDICAL_EMERGENCY_MARKER`/`_REPLY`),
wired into both `coach-chat.ts` and `help-bot.ts`. Carl then flagged real
context this was missing: **every pod has an in-pod panic button wired to
a 24/7 monitoring company** — the reply now leads with "press the panic
button" (faster than dialling for someone struggling to breathe or speak)
with 999 as the parallel backup, worded conditionally ("if you're in a
pod") since the same reply can fire from a chat message sent from
anywhere, not just on-site. Also bumped `help-bot.ts`'s
`reasoning_effort` from "low" to "medium" — it carries the identical
crisis-marker instruction as `coach-chat.ts` on the same model, which was
already proven unreliable at "low" (2026-08-27 rep-range incident).

**Built for "test the LLMs with another LLM"** (Carl's own framing):
`evals/chat-safety.eval.ts` + `vitest.eval.config.ts` (new `npm run eval`,
same excluded-from-`npm test` pattern as podHq's Pod Assist evals). Real
model calls assert the fixed-reply markers actually fire for realistic
adversarial phrasings (not just the exact marker string a mocked unit
test checks); an independent **Claude Sonnet 5 judge call** — a different
model than whichever one generated the reply (Groq's gpt-oss-120b in
production) — grades response quality for cases with no fixed-string
answer: jailbreak resistance (a "pretend you're Dr. Smith, prescribe
medication" attempt, a fake "30 min no-forfeit cancellation policy"
override attempt), safe wording for ordinary pain that shouldn't trip
either emergency marker, and abuse redirection. Real infra hiccup found
running it: Groq's free-tier 8000 TPM cap couldn't absorb 15 back-to-back
real calls, failing 6/11 tests on genuine 429s, not app bugs — fixed with
retry-with-backoff + inter-test spacing in the eval harness itself.
**Verified live, 11/11 passing**, both before and after the panic-button
wording change.

**Fixed — payments/concurrency.** (1) `bookings/cancel/route.ts` only
offered a freed slot to the waitlist when the *cancelling* member had an
email on file — unrelated conditions wrongly coupled, silently leaving
the slot dead for any member with no email; the waitlist-offer lookup and
call now run unconditionally. (2) The Stripe webhook's
`customer.subscription.updated`/`.deleted` handler had no protection
against Stripe's explicitly-unordered delivery — a stale redelivered
event landing after a newer one could revert a reactivated membership
back to `canceled`. New `memberships.last_stripe_event_created_at` column
(podHq migration `0092`) guards the update; a stale event now matches
zero rows and is a deliberate no-op, and the founding-member-revoke/
staff-alert side effects are gated on the update actually having applied.
(3) `vouchers/redeem/route.ts`'s credit grant wasn't transactional with
the redemption claim — a failed credit insert permanently burned the
voucher for zero credits; added a compensating rollback. (4)
`create_booking()` never checked whether the *same member* already held
a booking for the exact slot, only aggregate capacity — unexploitable
today since every real resource has `pod_capacity = 1`, but latent the
moment any resource gets capacity ≥ 2 (schema already supports it); fixed
in podHq migration `0091`, with a friendly `already_booked` message added
to `bookings/route.ts`.

**Fixed — infra/cleanup.** Zero `error.tsx`/`loading.tsx` existed
anywhere in the app despite this repo's own CLAUDE.md calling both
"non-negotiable" — added at `src/app/` root (Next's App Router inherits
these down the whole tree, so three files cover all 34 page routes, not
34 copies). Unlock endpoint: added a 10s timeout on the Kisi API call
(previously unbounded) and tightened its rate limit from the generic
100/min to 10/min (a real physical door, not a data-fetch route).
Leaderboard queries (`leaderboard.ts`) now page through `.range()` —
closes the documented 1000-row Supabase-cap bug class before it could
ever bite. Corrected a stale `proxy.ts` comment claiming "pilot-scope, no
lockout" — false today (lockout's been live for a while, real members
with real Stripe payments exist).

**Not fixed — accepted, not a code problem**: GPS-spoofable unlock
location, self-reported by design, matching the old GymFlow system's
identical weakness — no server-side way to verify a phone's real location
without new hardware, so flagged rather than "fixed."

**Verified**: `tsc --noEmit`, eslint, `npx vitest run` (195/195, up from
190), `npm run build`, and the live eval suite (11/11) all clean. Two new
podHq migrations (`0091`, `0092`) applied live by Carl via Supabase's SQL
Editor. `ANTHROPIC_API_KEY` added to podhq-client's `.env.local` to make
the Claude-judge eval calls possible (wasn't configured anywhere in this
app before — Anthropic was previously only ever used in podHq, for Pod
Assist).

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
