# Archive 69 — Play Store submission prep: domain switch, privacy disclosure (2026-09-08)

Split out of `ROADMAP.md` 2026-09-09 to stay under the ~15,000-character
import limit. See `ROADMAP.md`'s own header for the full archive-splitting
convention.

## Play Store submission prep — domain switch, privacy disclosure — 2026-09-08

**`myfitpod.app` registered via Vercel Domains and confirmed working** (real login, real Hove data) — `capacitor.config.ts` now points the native app at it instead of `podhq-client.vercel.app`. `.aab` rebuilt same session (`android/app/release/app-release.aab`, 2026-09-08 17:51) against the new domain.

**Removed the now-redundant PWA install prompt**: the bottom nav's "Install" button (`beforeinstallprompt`/iOS add-to-home-screen) and its `use-install-prompt.ts` hook are gone now that a real native Android app exists.

**Privacy policy gap found and fixed while filling out Google Play's Data Safety form**: `/api/unlock/route.ts` has always captured and stored real GPS coordinates against every door-unlock attempt (`pod_access_events.reported_latitude/longitude`), but this was never disclosed in the privacy policy — a real pre-existing gap, not new behaviour. `privacy-policy.ts` now discloses it.

**Verified**: none of this was documented in `ROADMAP.md` at the time per this file's own session-handoff convention — backfilled the next session (and initially mis-stated the `.aab` as unrebuilt from the commit message alone before checking the actual build artifact's timestamp). **Not yet verified**: Play Console submission itself hasn't happened; the door-unlock → auto-navigate → welcome-banner flow and the Android geolocation permission fix (from the prior session) still haven't been watched on a real device.

Note: as of the 2026-09-09 session that follows this one in `ROADMAP.md`, Play Console submission *has* since happened (Production track, full Data Safety/content rating/etc. completed, submitted for review) — this archived entry reflects state as of 2026-09-08 only, not current status.
