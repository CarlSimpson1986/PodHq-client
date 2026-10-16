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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-75.md`, covering the pilot
mechanism proof (2026-08-05) through PDK auto-link (2026-09-23) —
all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. Archives aren't always the strictly oldest material —
the split point is "what's finished and stable" as much as "what's
oldest" (see each archive's own header note for examples).
Reference-only, not auto-loaded by CLAUDE.md; check them for full build
history, or `git log` on this file for exact split points. Active
content here starts at "Planned (not built): Wellhub" (2026-09-25). If
this file grows too large again, split it the same way: move the most
clearly finished section into `ROADMAP-ARCHIVE-76.md`, update this
paragraph.

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

## Lead nurture: consent box + Brevo sync — 2026-10-04

Signup has an unticked-by-default "Email me tips and offers from My Fit Pod <gym>" box → `members.marketing_consent_at` (podHq `0106`). On a confirmed email-link sign-in, `syncConsentedLeadToBrevo` (`src/lib/leads/brevo-lead.ts`) adds a consenting, never-purchased member to their gym's Brevo list via podHQ's internal `/api/brevo/lead` (Brevo keys stay in podHQ; same `PODHQ_BASE_URL`/`PDK_PROXY_SECRET` as the PDK proxy). The Stripe webhook's fresh-insert gates call `markFirstPurchase` — first real purchase (pack, membership, gift voucher; not staff comps) sets `first_purchase_at` and removes them from the list, which ends the Brevo workflow. Service emails unaffected. No backfill. Not yet verified live. Full write-up: podHq `ROADMAP_HISTORY.md` #70.

## Hove unlock fix: booking-length PDK access — 2026-10-13

Hove unlocks all failed on 8 Oct with `PDK group "Booking Access" not found`, because Hove's PDK system ("Brighton") had no such group. Carl created it. `api/unlock/route.ts` now sends `accessUntil` (the end of the unlock window) to podHQ, which at Hove removes the member from the group once that time passes (podHq `0107`, 5-minute cron). Fairford Leys is unchanged (GymFlow manages its group). Full detail in podHq's `ROADMAP_HISTORY.md` #71. 10-15: PDK rule added (06:00–22:00); unlock window now never opens before `open_hour` (`unlock-window.ts`, 226 tests). **Outstanding:** a live test at Hove.

## Apple resubmission: signup email link, Checkout in-app, iOS builds 12–13 — 2026-10-13

Recording Apple's 2.1 walkthrough on an iPhone turned up three bugs. (1) The signup confirmation link (PKCE `?code=`) only works on the device that signed up, but from the app it opens in Gmail/Safari, so it always said "Link expired". The Supabase **Confirm signup** template now links to `/auth/confirm?token_hash=…&type=email` (Carl changed it by hand; Magic Link left alone because podHQ staff use it). `/api/auth/confirm-email` runs `verifyOtp`, syncs the Brevo lead, signs out, and the page goes to `/login?confirmed=1` ("Email confirmed. Sign in to get started."). Old `?code=` links that can't be exchanged go to the same place. (2) The signup "Check your email" screen has an "I've confirmed my email — continue" button, and an unconfirmed login says "Please confirm your email first" instead of "Invalid email or password". (3) Stripe Checkout went to Safari (Capacitor blocks other hosts), so Checkout's X landed on our site with no session and looked like a logout. Fixed with `allowNavigation: ['checkout.stripe.com']` (`168046e`), which needs native builds: **iOS build 13 done (Codemagic); Android not rebuilt yet.** Also: the decorative `PageHero` icon is dropped where it isn't a link, and the delete-account copy says 7 days. Verified live with bogus tokens/codes. A real token_hash confirmation hasn't been seen end to end yet, and Checkout in-app needs checking on build 13. Apple: the new recording (sign-up → email → sign in → Book/Shop → Delete account) was being submitted with build 13 at session end. Demo account member 153 topped up (+10 pod, +5 recovery).

## Locked-out test member: reset links didn't clear the lock — 2026-10-16

Test member 155 (Tom, Hove) got into the app via "Forgot password" without setting a password, and stayed locked. `auth_events`: a password saved 8 Oct 13:59 (`password_reset_completed`); every password sign-in since has failed (10 across 15–16 Oct → `account_locked` 11:53); three reset links used, none saved a password. Ruled out (Carl's SQL on `auth.users`): email typed differently, no password, duplicate account. **Why the 8 Oct password never matched is unproven** — likely an iPhone-suggested strong password or an old saved one; Carl says it wasn't wrong. Three changes: (1) `complete-callback` logs `login_success` (detail `email link`) for the user the link signed in, so any email link clears a hard lock — before, only saving a password did, and there's no admin unlock. (2) Locked message says use "Forgot password?" instead of "Contact support". (3) `/reset-password` boxes start as plain text (`PasswordInput initiallyVisible`), so iOS doesn't offer a random strong password. **Verified on local dev** (Dev Test Member 151, Chrome): boxes render `type=text`; saved a new password → `/book`; signed out; signed in with it → `/`. tsc/eslint/vitest 226 clean. **Not verified:** (1) end to end — needs a real reset link (151's inbox is fake); check via `auth_events` for a `login_success` / `email link` row after Tom's next reset.
