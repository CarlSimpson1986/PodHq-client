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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-68.md`, covering the pilot
mechanism proof (2026-08-05) through decline-detection going live
(2026-09-08) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Play Store submission prep" (2026-09-08).
If this file grows too large again, split it the same way: move the most
clearly finished section into `ROADMAP-ARCHIVE-69.md`, update this
paragraph.

## Play Store submission prep — domain switch, privacy disclosure — 2026-09-08

**`myfitpod.app` registered via Vercel Domains and confirmed working** (real login, real Hove data) — `capacitor.config.ts` now points the native app at it instead of `podhq-client.vercel.app`. `.aab` rebuilt same session (`android/app/release/app-release.aab`, 2026-09-08 17:51) against the new domain.

**Removed the now-redundant PWA install prompt**: the bottom nav's "Install" button (`beforeinstallprompt`/iOS add-to-home-screen) and its `use-install-prompt.ts` hook are gone now that a real native Android app exists.

**Privacy policy gap found and fixed while filling out Google Play's Data Safety form**: `/api/unlock/route.ts` has always captured and stored real GPS coordinates against every door-unlock attempt (`pod_access_events.reported_latitude/longitude`), but this was never disclosed in the privacy policy — a real pre-existing gap, not new behaviour. `privacy-policy.ts` now discloses it.

**Verified**: none of this was documented in `ROADMAP.md` at the time per this file's own session-handoff convention — backfilled the next session (and initially mis-stated the `.aab` as unrebuilt from the commit message alone before checking the actual build artifact's timestamp). **Not yet verified**: Play Console submission itself hasn't happened; the door-unlock → auto-navigate → welcome-banner flow and the Android geolocation permission fix (from the prior session) still haven't been watched on a real device.

## Native FCM push — real bug fix, not yet live-verified — 2026-09-09

**Real bug, found from Carl testing in-app push in the internal test build and getting nothing.** Root cause: the native Android app runs via Capacitor's `server.url` mode, i.e. `myfitpod.app` loaded inside Android's plain system WebView (`BridgeActivity`), not Chrome. `subscribeToPush()`/`send.ts`'s existing implementation is plain browser Web Push (service worker + `PushManager` + VAPID) — fine for real browser/PWA visitors, but a WebView has no persistent background registration to wake the app process on an incoming push the way Chrome does. This was already flagged as an open, untested risk in the 2026-09-07 pre-launch audit; this session is where it actually got hit.

**Fix: added a real native FCM path alongside the existing web-push path, not a replacement.** New `push_device_tokens` table (podHq migration `0095`, separate from `push_subscriptions` since the two delivery mechanisms need different data shapes — endpoint/p256dh/auth vs. a single FCM token). Client: `native-subscribe.ts` (`isNativePushSupported()` gates on `Capacitor.isNativePlatform() && getPlatform() === "android"`, same pattern as `health-connect-client.ts`) uses `@capacitor/push-notifications` to request permission and register a device token, POSTed to new `/api/push/register-device`. `bookings-view.tsx`'s existing enable-notifications UI/auto-resubscribe effect now branches on `isNativePushSupported()` — native permission tracked via `PushNotifications.checkPermissions()` (the WebView's own `Notification.permission` isn't reliable here, so it's not reused for this branch) rather than folded into the existing web `notifPermission` state. Server: `send.ts` now sends to both `push_subscriptions` (web-push) and `push_device_tokens` (Firebase Admin SDK) in parallel per member, combining results; a member can hold rows in both without either impacting the other.

**Gradle wiring**: `@capacitor/push-notifications` installed, `npx cap sync android` run to register it as a native module. The Google services Gradle plugin classpath and its conditional `apply plugin` (gated on `google-services.json` existing) were already present in `android/build.gradle`/`android/app/build.gradle` from the Capacitor Android template — no manual plugin-block edits needed, and Carl was warned off following Firebase's generic "Add Firebase to your app" docs literally, since that would have double-applied the plugin and broken the build. `@capacitor/push-notifications` itself already depends on `com.google.firebase:firebase-messaging` — no separate `firebase-bom`/`firebase-analytics` needed.

**Two real external setup steps, done by Carl this session**: a Firebase project (`my-fit-pod`) created, Android app registered under `uk.co.myfitpod.app`, `google-services.json` downloaded and placed at `android/app/google-services.json` (gitignored — added to `.gitignore` this session, wasn't already). A service-account key generated from the same project and set as `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel (Production) for `send.ts`'s server-side Admin SDK calls.

**Verified**: `tsc --noEmit`, eslint, `npx vitest run` (217/217, unchanged — no new unit tests, this is browser/native-API wiring in the same style as the untested parts of `subscribe.ts`/`health-connect-client.ts`), and `npm run build` all clean. **Not yet verified**: migration `0095` hasn't been run against Supabase yet; no signed `.aab` has been rebuilt with this code (the existing keystore at `~/Documents/myfitpod-release-key.jks` isn't wired into `build.gradle` as a signing config — last `.aab` was signed via Android Studio's Generate Signed Bundle wizard, deliberately not reproduced from the command line here to avoid touching Carl's signing credentials); and the actual end-to-end delivery (a real push arriving on a real device after registering) hasn't been watched happen yet.
