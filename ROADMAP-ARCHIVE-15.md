# ROADMAP Archive 15 — Wearable Integration Research (2026-08-24)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-24 (same day, once more) once that file exceeded Claude Code's
~15,000-character `@`-import limit again. This is the research thread
that led directly to the Fitbit-via-Google-Health-API scaffolding that
now lives in the active `ROADMAP.md` — moved here once its conclusions
were stable and acted upon, same "move what's finished, not necessarily
what's oldest" logic as `ROADMAP-ARCHIVE-14.md`. The equipment-aware AI
Coach summary and everything after it continue in the active
`ROADMAP.md`.

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

**Follow-up: Garmin ruled out, Google Health API confirmed self-serve —
2026-08-24.** Carl considered buying a Garmin device to test against
before building anything — checked live whether that's actually
buildable right now, for any of the three brands he asked about by name:

- **Garmin: not currently buildable, independent of the App Store
  question.** The Garmin Connect Developer Program (Health/Activity APIs)
  isn't a self-serve key like Stripe/Kisi — it's partner-approval-only,
  and as of this check is **closed to new sign-ups entirely**, no
  published re-open date. Even when open: a manual, weeks-long
  business-level review, often with a one-time ~$5,000 setup fee for the
  Health API. There's currently nothing to apply to.
- **Fitbit: buildable today, but only via the Google Health API, not
  Fitbit's own endpoints** — confirms and extends the 2026-08-24 note
  above. Google's `google_health` integration went live May 2026 and
  runs in parallel with legacy Fitbit endpoints until the September 30
  2026 cutover; access is genuinely self-serve (register via Google
  Cloud Console, standard Google OAuth 2.0, no partner approval, no fee)
  — a materially easier access model than Garmin's. Any new integration
  should target this directly, not legacy Fitbit Web API auth (existing
  Fitbit users of a future integration would need to re-consent anyway,
  since it's a different OAuth library).
- **Apple: not a "register for an API" option at all** — HealthKit has
  no cloud API by design (see the note above), so it isn't comparable to
  Garmin/Fitbit as a choice. It only works inside a native (or
  Capacitor-wrapped) app with real entitlements, via the App Store path
  already researched. Its real advantage: once built, it can surface
  *any* brand's data a member already syncs to Apple Health on their
  phone (Garmin, Whoop, Oura, etc.) without needing a separate developer
  deal with each vendor — at the cost of committing to the native-app
  path.

**Net near-term recommendation**: Google Health API (→ Fitbit data) is
the one path buildable today with no App Store submission and no
gatekeeper. Garmin stays parked until/unless their program reopens —
buying a Garmin device is fine for Carl's own hands-on familiarity, but
won't unblock actual data access on its own.

Sources: [Health API | Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/health-api/),
[Garmin Developer Portal — Connect API](https://developerportal.garmin.com/developer-programs/connect-api),
[Data Access and Authorization | Google Health API](https://developers.google.com/health/migration/data-access),
[Overview | Google Health API](https://developers.google.com/health/migration).

**Follow-up: Whoop, Oura, and a Samsung correction — 2026-08-24 (same
day).** Carl asked whether Whoop and Oura are "good to go" the same way
Fitbit is, and separately noted Samsung "use[s] Google Connect as well"
— checked both live rather than assume either.

- **Whoop: yes, self-serve, free.** Sign up on whoop.com, create an app
  in the WHOOP developer dashboard, get a Client ID/secret immediately —
  no partner review to *start* building, unlike Garmin. The only gate is
  at the end: submitting the finished app for approval before public
  launch, which doesn't block development/testing.
- **Oura: yes, self-serve** — register an OAuth app at
  cloud.ouraring.com, no partner gate. Real caveat, not a build blocker
  but a reach one: a Gen3 Oura Ring alone isn't enough for a member's
  data to be accessible via the API — they also need an **active paid
  Oura Membership** (Oura's own subscription, ~£5.99/mo, nothing to do
  with MyFitPod). Fewer members would actually have usable data through
  this integration than through Whoop or Fitbit/Google Health, purely
  because of that extra subscription gate.
- **Samsung: correction, not confirmed as stated.** Carl's instinct that
  Samsung "uses Google" is half right but the wrong half of Google's
  stack — Samsung Health syncs to **Health Connect** (Android's on-device
  data layer, confirmed live), not the cloud **Google Health API** that
  Fitbit now runs through. Health Connect and Google Health API are the
  two distinct things the original 2026-08-24 note above already told
  apart — Samsung sits in the same native-only bucket as Apple HealthKit,
  not the same self-serve-PWA bucket as Fitbit/Whoop/Oura. A Samsung
  integration would need the native-app path already researched, not a
  plain server-side OAuth integration.

**Updated net picture**: Fitbit (via Google Health API), Whoop, and
Oura are all buildable today as plain server-side integrations into
podhq-client's existing API routes — no native app, no App Store/Play
Store submission, same shape as the Stripe/Kisi integrations already in
this codebase. Garmin and Samsung are both parked — Garmin because its
program is closed, Samsung because it's a Health-Connect (native-only)
source like Apple, not a cloud-API one.

Sources: [OAuth 2.0 | WHOOP for Developers](https://developer.whoop.com/docs/developing/oauth/),
[Getting Started | WHOOP for Developers](https://developer.whoop.com/docs/developing/getting-started/),
[The Oura API – Oura for Organizations Help Center](https://partnersupport.ouraring.com/hc/en-us/articles/20949682312211-The-Oura-API),
[Oura API](https://cloud.ouraring.com/docs/),
[Accessing Samsung Health Data through Health Connect | Samsung Developer](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect),
[Health Connect FAQ to Access Samsung Health Data | Samsung Developer](https://developer.samsung.com/health/health-connect-faq.html).
