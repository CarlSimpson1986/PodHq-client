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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-12.md`, covering the pilot
mechanism proof (2026-08-05) through training-block periodization Stage
12 (2026-08-23) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. All archives are reference-only (not
auto-loaded by CLAUDE.md); check them for full stage-by-stage build
history, or `git log` on this file for the exact split points. This file
picks up from the workout session exit/resume/warm-up/swap work
(2026-08-23) and is the active, auto-loaded log going forward. If this
file grows too large again, split it the same way into a numbered
`ROADMAP-ARCHIVE-13.md`, leave a pointer note at the top of this file,
and update this paragraph plus `CLAUDE.md`'s session-handoff guidance to
match.

## Workout session: exit, resume, warm-up/cool-down, exercise swap — 2026-08-23

Carl flagged there was no way to leave an in-progress workout session
(confirmed — every phase except the summary screen had no way out but
the browser back button), and asked for an opt-in warm-up/cool-down and
the ability to swap an exercise before starting. Scoped via
`AskUserQuestion`: warm-up/cool-down is a toggle on the overview screen
(default off), swap is same-muscle-group only. A Plan-agent review of
the draft design caught a real bug before any code was written:
reopening an exited session always restarted at exercise 1/set 1
(silently overwriting already-logged sets, since `log-set` is an UPDATE
on a pre-existing row) — fixed as part of this same change since the new
Exit button turns that from a rare accidental path into the primary way
back into a session.

**Exit + resume**: a small "← Exit" link (routes to `/`, matching
`CoachBottomNav`'s own convention) on every interactive phase; no
confirm dialog needed since nothing is lost by leaving. `workout-view.tsx`
now derives `hasProgress`/the first not-yet-completed exercise+set from
`detail` on load — the overview screen's button reads "Resume workout"
and seeds `exerciseIndex`/`setIndex` from that point instead of always
`0`/`0`.

**Warm-up/cool-down**: purely client-side, no DB changes — new
`src/lib/coach/warmup-cooldown.ts` with a fixed, hand-written
`WARMUP_ITEMS`/`COOLDOWN_ITEMS` list (generic bodyweight/mobility
content, flagged for Carl to review/replace, same sign-off convention as
`CALORIE_TARGET_FLOOR`). Two new client-only `Phase` values render a
tap-to-check checklist before the first exercise and/or after the last
set. Warm-up is only offered when starting fresh (`!hasProgress`); cool-
down is always offered, including on resume.

**Exercise swap**: `generate-workout.ts`'s inline injury filter was
extracted into an exported `getInjuryExcludedKeys()` (pure refactor, one
new direct unit test — the existing suite already covered it indirectly
through `generateWorkout`) and `computeWeightKgForBlock` was exported,
so the swap's weight recompute reuses the exact same RPE-history/deload
logic real generation uses rather than a second copy. New `swapExercise()`
in `workout-session.ts`, new `POST /api/member/workout/[sessionId]/
swap-exercise` mirroring `log-set`'s exact auth/rate-limit/IDOR pattern.
**Real bug the Plan-agent caught before this was built**: the eligibility
gate can't be `workout_sessions.status !== 'generated'` — status never
leaves `'generated'` until `completeSession()` runs, so that check would
have wrongly allowed a swap mid-session. Gates on whether any set in the
session has `completedAt` set instead — the same signal the client uses
to compute `hasProgress`. Candidates are computed client-side from the
already-bundled `EXERCISE_CATALOG` (confirmed no `server-only` guard on
that file) filtered by a new `excludedExerciseKeys` field on
`WorkoutSessionDetail`; the server independently re-validates muscle
group, injury exclusion, and duplicate-in-session on the actual POST,
never trusting the client's list.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (62/62 —
new `getInjuryExcludedKeys` tests, all previous tests unchanged), `next
build` all clean. Live-verified via the playground member: exit link
present on every phase; logged one set, exited, reopened the booking's
workout link — correctly resumed at "Set 2 of 2" instead of restarting,
button read "Resume workout", swap/warm-up options correctly hidden
once `hasProgress`. Swapped Barbell Squat → Leg Extension on a fresh
session — weight recomputed correctly (17.5kg = the catalog's
intermediate starting weight × the active deload block's 0.85 discount,
not a copy of the old exercise's weight), `sort_order` preserved. Direct
API calls confirmed the server rejects a cross-muscle-group swap, a
duplicate-in-session swap, a nonsense exercise key, and — after logging
one real set — any swap at all, even though nothing in the client would
ever send those. Ran a full session start-to-finish with both toggles
on: warm-up checklist appeared and checkmarks toggled correctly,
cool-down checklist appeared after the last logged set (not before),
"Finish" completed the session normally with real post-session
narration. One pre-existing, unrelated bug surfaced during testing: React Strict
Mode's dev-only double-effect-fire can race two concurrent `POST /api/
member/workout/generate` calls on first load, occasionally hitting
`workout_sessions`' `booking_id` unique constraint and returning a 500.
**Fixed same day** (see below) rather than left outstanding.

### Fix: workout-generate race condition — 2026-08-23 (later same day)

`getOrCreateWorkoutSession` now catches the `23505` unique-constraint
violation on `booking_id` and loads whatever the winning concurrent
request already created, instead of surfacing a 500 — the insert's
existence-check-then-insert window was never actually safe against a
second in-flight request for the same booking, dev-only Strict Mode
double-firing was just the reliable way to trigger it. Also updated the
warm-up/cool-down content per Carl's direct review (Peloton treadmill/
bike for the pulse raiser, fire hydrants for hip mobility) and corrected
`exercise-catalog.ts`'s equipment comment, which only listed the
resistance-training kit. **Verified**: live-reproduced the race (two
concurrent generate requests via the dev server log) and confirmed both
now return 200 with exactly one `workout_sessions` row written.

## Wearable integration research — Google Health API note — 2026-08-24

Not built, just documented for whenever this gets prioritised (Fitbit
was previously flagged as real wanted scope, a research spike not yet
started). Confirmed via live web search: Fitbit's legacy Web API is
being shut down **September 2026** — any future integration should
target the **Google Health API** directly (reached general availability
May 2026), not the old Fitbit endpoints, since OAuth tokens don't
transfer between them regardless of which is targeted first. **Health
Connect** (Android's on-device data layer) stays a separate thing and is
still native-only — same constraint the Coach hub's "Tech integrations"
placeholder already states for Apple Health.

Real nuance on "is there truly no way around it": **Apple Health/HealthKit
has zero cloud API by design** (Apple's own privacy stance, not a gap
that'll close) — that data only ever comes from a native (or
Capacitor-wrapped) app with real HealthKit entitlements, no workaround.
**Health Connect is less absolute**: if the underlying wearable brand
(Fitbit, Garmin, Whoop, Oura) has its own cloud API, that data is
reachable straight from the device maker's API without ever touching
Health Connect at all — Health Connect only matters for a source with no
cloud counterpart of its own. The realistic middle path if this gets
prioritised before a full native rebuild: wrap the existing PWA in a thin
native shell (Capacitor or similar) purely to get real HealthKit/Health
Connect entitlements, reusing nearly all of today's code rather than a
ground-up rewrite — matches the "high probability of an eventual native
app" Carl already flagged as likely once this is battle-tested.

**Follow-up: can a native shell avoid App Store submission entirely?**
No, not sustainably for iOS. TestFlight caps at 10,000 external testers
and builds expire every 90 days — not viable as a permanent way to serve
gym members. Ad Hoc distribution caps at 100 devices per device type per
year and needs each member's device UDID manually registered —
impractical at gym scale. Apple's Enterprise Program is explicitly
prohibited for distributing to customers/the general public, only a
company's own employees. The quietest real option ("Unlisted Apps," a
private link hidden from App Store search) still goes through Apple's
real submission/review pipeline. Android is genuinely more flexible —
APK sideloading from your own website works without ever touching Play
Store — but since iOS still needs the App Store regardless, there's
limited practical benefit to dodging Play Store separately.

**Timeline if/when this gets submitted**: not just the headline review
number. One-time setup first — Apple Developer Program enrollment is
~24-48h for an individual account, longer for a UK limited company
(needs a D-U-N-S number lookup); Google Play Console is same-day to
next-day, $25 one-time fee. Review itself: Apple resolves 90% of
submissions within 24h and 98% within 48h, **but health-category apps
requesting HealthKit access are explicitly flagged as one of the slower
categories** — up to a week or more, since each HealthKit data type
needs its own justified purpose string. Google Play runs 1-7 days for an
established developer account but **7-14 days for a first app** from a
brand-new account, which this would be. A first-time HealthKit
submission commonly gets rejected once over an incomplete privacy
purpose string and needs a quick resubmission — routine, not a red flag,
but realistic first-time budget is **1-2 weeks end-to-end for iOS**, not
the 24-48h headline figure, with Android's first-app review running
similar or slightly longer.

**How to actually pre-empt that first rejection**, confirmed via live
search rather than assumed:
1. **Specific, honest `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription`
   purpose strings** in Info.plist, tied to the real feature ("We read
   your sleep and step data to personalise your weekly AI Coach
   check-in"), not generic boilerplate — vague copy is the single most
   common HealthKit rejection reason.
2. **Only request the specific data types an actual visible feature
   uses** — requesting broad HealthKit access "for later" gets flagged.
3. **A real, specific privacy policy** covering health data — what's
   collected, how it's stored, whether it's shared, deletion/retention —
   not a generic template.
4. **An in-app "priming" screen explaining why before the system
   permission prompt fires** — reduces both reviewer confusion and the
   real-world rate of members declining the prompt.
5. **Accurate App Privacy "nutrition label" declarations in App Store
   Connect** matching what the app actually does — mismatches trigger
   rejection or later removal.
6. **A working reviewer demo account** — this app already has exactly
   what's needed for this: the persistent playground member
   (`playground@myfitpod.test`) with ~2 months of real seeded workout/
   nutrition history, built for internal dev testing. The same account
   doubles as Apple's/Google's reviewer login, which directly avoids the
   single most common *generic* (non-HealthKit) rejection reason —
   reviewers unable to access core functionality behind a real
   membership/trial gate.
7. **Payments — confirmed via live search, this is the single biggest
   real risk if handled wrong, not HealthKit wording**: pod credits/
   bookings are a *physical service consumed outside the app* (a real
   pod session), which explicitly qualifies for Apple's Guideline 3.1.3
   exemption from In-App Purchase — the existing Stripe checkout can
   very likely stay as-is in a native wrapper, without Apple's 15-30%
   cut. Reviewers do sometimes misapply 3.1.1 to this kind of app
   regardless, so the App Review Notes field on submission should
   explicitly state the physical-service exemption up front, rather
   than leaving the reviewer to work it out.
