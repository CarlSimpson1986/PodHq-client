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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-74.md`, covering the pilot
mechanism proof (2026-08-05) through the Apple 2.1 reply prep (2026-09-15) —
all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. Archives aren't always the strictly oldest material —
the split point is "what's finished and stable" as much as "what's
oldest" (see each archive's own header note for examples).
Reference-only, not auto-loaded by CLAUDE.md; check them for full build
history, or `git log` on this file for exact split points. Active
content here starts at "PDK auto-link on first unlock" (2026-09-23). If
this file grows too large again, split it the same way: move the most
clearly finished section into `ROADMAP-ARCHIVE-75.md`, update this
paragraph.

## PDK auto-link on first unlock, booking-email timezone fix — 2026-09-23

**Steve (Fairford Leys owner) got "Your access isn't set up yet — contact staff" at the door.** `api/unlock/route.ts` required `members.pdk_holder_id`, which only Carl's test account (member 157) ever had, set by hand in podHq's `0100` — every other PDK-gym member was locked out. Now, with no holder ID, the route sends the member's name/email to podHQ's `/api/pdk/unlock`, which reuses their PDK holder by exact email match or creates one, adds it to "Booking Access", unlocks, and returns the ID, saved here even on a failed unlock so a retry doesn't duplicate it. Proxy timeout raised 10s → 25s (a first unlock chains several PDK calls plus one 2s retry). Details in podHq's `ROADMAP_HISTORY.md` #66. **Verified live 2026-09-23 14:49** (member 158, Fairford Leys "Entrance"): PDK's own audit log shows the holder created and added to Booking Access by "Integration Client", then "Access allowed" via API — no manual PDK step, first read succeeded without the retry. Still not built: `members.unlimited_access` (owner unlock without booking, schema only).

**Follow-up, same session**: Carl's first live test hit "Turn on location services" — both Unlock buttons (`upcoming-session-card.tsx`, `bookings-view.tsx`) hard-stopped client-side whenever geolocation failed, even at Fairford Leys, whose resource has no coordinates so the server would never check. Location is now sent when available and omitted otherwise; the server remains the only gate (it still blocks a missing location at resources with coordinates).

**Speed follow-up**: Carl found the first live unlock slow. The Unlock buttons now only request geolocation when the resource has coordinates (`PodResource.requiresLocation`; unknown resources default to asking) and accept a fix up to 60s old — up to 10s of location lookup was dead time at Fairford Leys. podHQ caches its PDK token too (its `ROADMAP_HISTORY.md` #66).

**Location enforced at Fairford Leys + staff alert on door failure**: Carl set Fairford Leys' coordinates (51.820265, -0.836716, 100m radius — tighter than the 300m default, phone GPS indoors makes much below ~100m refuse genuine members). Only Aylesbury Berryfields had coordinates before (podHq `0013`); every other gym has no GPS gate, and PDK's API exposes no location (Kisi's does, per place/lock — an unbuilt option for backfilling Kisi gyms). New: when the door system itself fails (not this app's own "blocked:" refusals), the gym's owner(s) + admins get a `staff_unlock_failed` email (member name, mobile, door, slot, the door system's error) — once per booking, not per retry. Not yet seen fire live.

**Email logo not showing**: `https://www.myfitpod.app/icons/icon-512.png` returns 200, `podhq-client.vercel.app/...` 404s — consistent with Vercel's `APP_URL` still pointing at the retired alias (not inspected). `appUrl()` (`notifications/core.ts`) now returns the canonical `PRODUCTION_ORIGIN` in production regardless of `APP_URL`, fixing the logo and every email CTA link at once. Carl to confirm in the next real email.

**Booking emails showed slot times an hour early** — `formatSlot` in `notifications/templates.ts` had no `timeZone`, and Vercel runs UTC; now `Europe/London`.

**Not a bug**: a Brighton "AAL2 session is required to update email or password when MFA is enabled" reset error was the shared Hove podHQ staff login (2FA-enabled) being entered in the member app. Staff logins reset via podHQ; members should use their own email.


## Planned (not built): Wellhub check-in enforcement, Facebook ads sync — 2026-09-25

**Wellhub.** Problem (Carl): Wellhub members use the gyms without checking in on Wellhub, so those visits go unpaid. We're already Wellhub partners; nothing validates check-ins today. Plan: Wellhub members sign up here and link their Wellhub ID (one account per ID), book pods normally without credits, and **Unlock validates their Wellhub check-in via Wellhub's Access Control API before opening the door** — no check-in, no entry. Each gym has its own Wellhub agreement and rate, so each owner enters their own Auth Token + Wellhub gym ID on a new encrypted card on podHQ `/setup` (same pattern as `gym_resend_config`). A new Wellhub account can hold only one upcoming booking until its first validated visit. Owners get a log of validated/refused visits to check against Wellhub payouts. **For this to work, Wellhub members' standing Kisi/PDK access must be removed** at each gym, or they bypass the app. Open: a fixed credit cap vs. uncapped (Carl floated 10 credits; recommendation is uncapped, since Wellhub's plan already limits visits). **Blocked on**: Wellhub's Access Control API docs (check-in-first rules, pre-visit ID lookup, whether the name is returned) and per-gym tokens + sandbox. Carl is emailing his Wellhub account manager (draft agreed in-session). Next useful step: measure the unpaid visits by comparing Wellhub members' door entries (podHQ `door_entries`, back to 2023) against Wellhub portal check-ins — needs a list of who's on Wellhub.

**Facebook ads — parked.** Replace campaign CSV downloads with Meta's Marketing API (free). Franchisees run their own ad accounts, so the agreed design is a "Connect Facebook" button on podHQ `/setup` (Facebook Login for Business, non-expiring token), not pasted keys. Needs Meta business verification + App Review on Carl's side first.

**Also this session (podHQ, see its `ROADMAP_HISTORY.md` #68):** Kisi + PDK door entries cached monthly into `door_entries` (backfilled to each site's install date, Aylesbury Jan 2023), `/door-traffic` page, and an anon-callable `delete_member_cascade` locked down (`0104`). Step 2 there is turning door entries into `attendance` rows to replace GymFlow's CSV for door-connected gyms.

## In-app account deletion link for Apple review — 2026-10-01

Apple re-rejected build 11 under 2.1 with only a generic "resubmit once adjustments are made" message, after Carl had already replied to the 2026-09-15 information request and resubmitted. Most likely cause (unconfirmed — Carl has asked Apple for specifics): their checklist requires the recording to show **account deletion**, and the app had no in-app path to it — `/delete-account` existed only as a public URL for Google Play. Added a "Delete account" link under Log Out on `/profile`, plus a "Back to profile" link on `/delete-account` (native shell has no browser back). Web-only, no native rebuild. Verified in local dev (Profile → Delete account → back); the request form itself wasn't submitted. **Outstanding:** wait for Apple's reply; then a fresh recording on the latest iOS (launch → sign up → login → paid flow → delete account), reply + Notes pointing at Profile → Delete account (and that PDK unlock is now live), resubmit.

## Play Store live; 10-day trial, video loading, splash screens — 2026-10-03

**My Fit Pod is live on Google Play** (Carl confirmed, after the 2026-09-17 icon-mismatch removal and resubmission).

- **Premium trial 7 → 10 days** — `TRIAL_LENGTH_DAYS` in `trial-state.ts`, used by `coach-profile/route.ts`; all "7-day" UI copy updated. New trials only — members already mid-trial keep their existing `trial_expires_at`.
- **"Today's pick" badge** (`block-workout-preview.tsx`) moved right, beside the chevron — inline after the title it wrapped flush-left on phones.
- **Exercise videos** — new `exercise-video.tsx` (`ExerciseVideo`/`ExerciseYoutubeEmbed`/`PreloadExerciseVideo`): black backdrop + spinner until the first frame, used everywhere a technique clip plays; the workout flow preloads the next exercise's clip. Root cause of the slowness found in the files themselves: all 76 uploads are 1080×1920 at ~12 Mbps (7–12 MB each, 556 MB total) **and have the `moov` atom at the end**, so nothing can render until most of the file arrives. Re-encoded locally to 720p CRF 27 with `+faststart` (30 MB total, visually identical). **Not yet uploaded** — the bulk overwrite of the live `exercise-videos` bucket was blocked by the permission classifier; Carl to decide (permission rule, or re-upload via podHq's exercise-videos page). Future uploads via that page will have the same problem unless compressed first.
- **Splash screens were still Capacitor's placeholder** (blue X on white) on both platforms — same miss as the icon incident. Replaced with the logo on black; Android 12+ `windowSplashScreenBackground` black; `backgroundColor: '#000000'` in `capacitor.config.ts` (a cold emulator launch showed several seconds of white WebView between splash and sign-in). Verified on the emulator: splash → black → sign-in. Android versionCode 9 / 1.0.8 — Carl built the signed bundle and **submitted to Play review 2026-10-03**. iOS splash changed in the repo but untested (no Mac) — check it on the next iOS build for the Apple re-recording.
- Spinner verified in local dev by dispatching `loadeddata` (Chrome won't load media in the hidden automation window); real load speed needs checking on a phone once the compressed files are live. tsc/eslint/vitest (217) clean.

## Two-door unlock for Hove (PDK live) — 2026-10-04

Hove's PDK went live with three readers: main entrance, gym, recovery room. A Hove booking now shows two always-visible buttons, "Open main door" and "Open <room> door", both on the booking's normal unlock window (5 min before → slot end + 5). Carl chose two buttons over one that advances after a tap — at an unmanned site the member just taps the door they're standing at. `/api/unlock` takes `door: "entrance" | "room"` (default `room`; `entrance` needs `provider_config.entranceDeviceId`, set by podHq `0105`); main-door taps log as `main door: …` and don't start the session timer or jump to the workout. Single-door gyms unchanged. Also fixed: Home and `/bookings` now load a cross-gym booking's own resource, not just the home gym's. Verified locally (no doors tapped) incl. gym + recovery overlap; **live unlock at Hove still to do.** Full write-up: podHq `ROADMAP_HISTORY.md` #69.
