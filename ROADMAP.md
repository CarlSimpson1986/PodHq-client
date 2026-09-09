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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-70.md`, covering the pilot
mechanism proof (2026-08-05) through native FCM push going live
(2026-09-09) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Health Connect permission trim"
(2026-09-09). If this file grows too large again, split it the same way:
move the most clearly finished section into `ROADMAP-ARCHIVE-71.md`,
update this paragraph.

## Health Connect permission trim + full Play Store submission — 2026-09-09, same session

**`@capgo/capacitor-health`'s own bundled manifest declares 46 Health Connect read/write permissions unconditionally** — `health-connect-client.ts` only ever reads 4 (steps, sleep, restingHeartRate, HRV) and this app never writes to Health Connect at all. Found via Play Console's Health apps declaration, which requires a separate written justification per declared permission — ~40 fields for things never used, and Google's own guidance says unused ones should be removed, not justified. `tools:node="remove"` in `AndroidManifest.xml` strips the 42 unused ones at manifest-merge time (verified against the actual merged output, not assumed) rather than editing the plugin's own manifest, which npm would overwrite on the next install.

**Every CLI-verified native change this session** (JDK toolchain, manifest fixes, permission trim) **was built and confirmed via a clean `gradlew bundleRelease` run before asking Carl to touch Android Studio again** — given how many rebuild rounds this session already cost him, each one was checked first rather than sent on faith. `versionCode` climbed 2→6 across the session (permission fix, icon meta-data, local-notifications, domain fix, Health Connect trim, first Production release).

**Full Play Store submission completed this session, not just prepped**: dedicated review test account created (`playstore-review@myfitpod.app`, Hove, fully onboarded — waiver signed, privacy policy accepted, tour skipped, trial extended a year so `hasPremium()` grants access with no membership row needed, 5 credits granted) via a disposable Admin-API script (`scripts/create-play-review-account.mjs`). New public `/delete-account` page + `/api/account/delete-request` (IP-rate-limited, forwards to staff via existing `getStaffRecipients` routing, deliberately manual not automated — a real person checks Stripe/booking history before anything's deleted) satisfies Play's account-deletion requirement, which this app had no mechanism for at all before tonight. Content rating (All Other App Types, In-App Purchases flagged, ratings 3+/PEGI 3/Everyone across regions), target audience (18+, minors restricted), Data Safety questionnaire (full pass — location, personal info, financial info, health/fitness, messages, device IDs, each with collected/shared/ephemeral/required/why-collected answered against the real code, not guessed), financial features (none apply), app category (Health & Fitness), store listing copy, app icon (existing `icon-512.png`), feature graphic (Carl's own Canva design), and phone screenshots all completed. **Submitted for review** via Production track (`versionCode 6`) — sitting in Google's automated pre-check as of session end, not yet approved.

**Real, useful side-finding, not part of tonight's actual scope**: there's already a published Play Store app called "My Fit Pod" by a developer named "Gymflow" (1K+ downloads) — almost certainly this gym's old GymFlow-era generic booking app. Carl's call: proceed as-is, not worth renaming over.

**PDK scouting, not building yet** (per its own "deliberately last" framing — see AI coach/app-store memory): real hierarchy found via S&D Group's PDK dashboard — `system → cloud node (controller hardware) → device (individual door)`, each with its own UUID (e.g. the Fairford Leys "Entrance" door: `system fdbb9678-.../cloud-node 29659376-.../device 7befe549-...`). Confirms a future `gym_pdk_mapping` table would need per-door `device_id`s, not just a per-gym system ID — mirroring `gym_kisi_mapping`'s shape but with PDK's own IDs. Carl also asked S&D Group for dealer-level (not per-system) API permissions, since the dealer account is exclusively his own gyms with no unrelated tenants — the right call given that.

## HealthKit (iOS) scaffolded, genuinely untested — 2026-09-09, same session

**Real build-out, not a stub**, done autonomously while Carl was away (explicit "do as much as you can without me"). Entitlement (`App.entitlements`, `com.apple.developer.healthkit`, clinical-records scope deliberately omitted — only basic vitals are ever read), `Info.plist` gained `NSHealthShareUsageDescription` (read-only — `health-connect-client.ts` never requests write access, so `NSHealthUpdateUsageDescription` is correctly omitted, same "declare only what's used" principle as tonight's Android permission trim) and `NSLocationWhenInUseUsageDescription` — the same bug class as Android's missing `ACCESS_FINE_LOCATION` fixed earlier tonight, the door-unlock geofence would have silently failed on iOS too. `CODE_SIGN_ENTITLEMENTS` wired into `project.pbxproj` for both build configs, plus a proper `PBXFileReference`/group entry so Xcode's navigator shows the file correctly.

**`@capgo/capacitor-health`'s iOS Swift source confirmed (read directly, not assumed) to expose the same method names and the same four `HealthDataType` identifiers already used for Android** (steps/sleep/restingHeartRate/heartRateVariability) — `health-connect-client.ts`'s actual read logic needed zero changes, just widened platform gating.

**`WearableProvider` gained `"healthkit"`** as its own value (not reusing `"health_connect"` for both platforms) so a member sees which of their own OS's health app they connected — no schema migration needed, `provider` is plain text, TS-union validated only (this project's own established convention). `isHealthConnectSupported()` → `isOnDeviceHealthSupported()` (covers both platforms), new `onDeviceHealthProvider()` picks the right one at runtime. `/api/wearables/health-connect/connect` now takes an explicit `provider` in the request body instead of hardcoding `"health_connect"`.

**A fourth XML `--` mistake, self-caught via the same Python XML-validation check adopted after the third one tonight** — worth noting since it confirms that check is now a genuinely load-bearing habit, not optional.

**Explicitly, honestly untested**: no Mac/Xcode available this session, so none of this has been built, run in a simulator, or verified beyond `tsc`/`eslint`/`vitest`/`next build` all passing clean. Do not treat this as "HealthKit works" — treat it as "the scaffolding is in place for whenever Carl has Xcode access (Codemagic, per tonight's discussion) to actually build and test it."
