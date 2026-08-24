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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-13.md`, covering the pilot
mechanism proof (2026-08-05) through the workout session exit/resume/
warm-up/swap feature and its same-day race-condition fix (2026-08-23) —
all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. All archives are reference-only (not auto-loaded by
CLAUDE.md); check them for full stage-by-stage build history, or `git
log` on this file for the exact split points. This file picks up from
the wearable-integration research note (2026-08-24) and is the active,
auto-loaded log going forward. If this file grows too large again, split
it the same way into a numbered `ROADMAP-ARCHIVE-14.md`, leave a pointer
note at the top of this file, and update this paragraph plus
`CLAUDE.md`'s session-handoff guidance to match.

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

## Equipment-aware AI Coach workout generation — 2026-08-24

Carl flagged that Lat Pulldown/Seated Row are prescribed as if every pod
has a dedicated machine for them, when in reality they (and Tricep
Pushdown) need to be done on a cable machine — and confirmed via
`AskUserQuestion` that the real fix is bigger than copy: `EXERCISE_CATALOG`
was one hardcoded list tuned to Hove's equipment, applied to every gym
regardless of what that gym's pod actually has (`hasPremium()`, which
gates AI Coach access, isn't gym-scoped at all). Designed via Plan Mode
before building; confirmed with Carl: one `cable_machine` category (not
split by pulley type — that nuance stays in exercise copy); an
unconfigured gym stays unrestricted (today's exact behavior) until Carl
explicitly sets its equipment; config lives in podHq's existing pod
Settings panel, not a new page.

**Data model**: `pod_resources.equipment text[] not null default '{}'`
(podHq migration `0056_pod_resources_equipment.sql`, no CHECK constraint,
same TS-union-at-the-boundary convention as `credit_type`) — empty means
unconfigured/unrestricted, not "no equipment." New `EQUIPMENT_TYPES`
union (`barbell_rack`/`cable_machine`/`dumbbells`/
`leg_extension_curl_machine`) duplicated verbatim across both repos'
`types.ts`, same convention as `GYM_NAMES`. Each `CatalogExercise` gained
`requiredEquipment: EquipmentType | null` (`null` for Plank).

**Generation**: `generateWorkout`'s `availableEquipment?: EquipmentType[]`
is optional, same "absent = byte-identical to before" idiom Stage 12 used
for `activeBlock` — `getOrCreateWorkoutSession` now looks up the
booking's resource's `equipment` and passes it through; a new
`getEquipmentExcludedKeys` mirrors `getInjuryExcludedKeys` and is unioned
with it into the single `excludedExerciseKeys` field the client already
reads for swap candidates, so the swap UI picked up equipment-awareness
with no client-side change needed.

**Real gap found and fixed along the way**: `swapExercise` had zero
gym/resource awareness before this — a member could swap into an
exercise their actual pod couldn't support even though the client's own
candidate list would never offer it. `workout_sessions.resource_id` (on
the row since resources existed, just never selected) is now read via a
new `getSessionResourceId`, and the swap re-validates equipment
server-side the same way it already re-validated injuries.

**podHq**: `PodResource` gained `equipment`, threaded through
`getPodResourcesForGym`/`getPodResourceById`/`updatePodResourceSettings`/
`updatePodSettingsSchema`; the pod Settings panel
(`calendar-view.tsx`) gained one checkbox per equipment category next to
the existing capacity/hours fields.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (podhq-client
67/67 including 5 new equipment tests; podHq 9/9), and `next build` all
clean in both repos. Carl ran the migration live in Supabase before this
was committed, specifically to avoid the AI Coach 500ing for every member
between a code deploy and the column existing (`getResourceEquipment` is
on every generate/resume/swap call path). **Still outstanding**: no gym's
`pod_resources.equipment` has actually been set yet (including Hove's
real, already-confirmed equipment) — every gym is still running
unrestricted until Carl works through the new Settings panel checkboxes
gym by gym.
