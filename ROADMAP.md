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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-72.md`, covering the pilot
mechanism proof (2026-08-05) through the first working Codemagic iOS build (2026-09-13/14) —
all split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. Archives aren't always the strictly oldest material —
the split point is "what's finished and stable" as much as "what's
oldest" (see each archive's own header note for examples).
Reference-only, not auto-loaded by CLAUDE.md; check them for full build
history, or `git log` on this file for exact split points. Active
content here starts at "App Store submission prep" (2026-09-14). If
this file grows too large again, split it the same way: move the most
clearly finished section into `ROADMAP-ARCHIVE-73.md`, update this
paragraph.

## App Store submission prep + emergency contact info — 2026-09-14, same-day follow-up

Walked Carl through App Store Connect's submission checklist for build 11 (Content Rights, Age Ratings, App Privacy, Keywords, Pricing, Category, Build selection) — Apple's own "Unable to Add for Review" list is the authoritative source of what's outstanding, not this file. One mistake mid-session: told Carl the app collects no phone number, missed `mobile_number` (labelled "Mobile" in `profile-view.tsx`, collected via `/access/contact`) — corrected once found.

Also shipped: **emergency contact info** — nullable `emergency_contact_name`/`emergency_contact_phone` on `members` (`podHq/supabase/migrations/0096_member_emergency_contact.sql`, not yet run — apply manually via Supabase's SQL editor), a new editable card on `/profile`, and `/api/member/emergency-contact`. Carl's call, prompted by the app's only emergency mechanism today being the member dialling 999 themselves or pressing the facility's own Emergency Button — neither helps if they can't act. Pure web/DB change, no native rebuild (native shell just loads the live Vercel deployment).

## Apple 2.1 review reply prep + dead confirmation-link fix — 2026-09-15, same session

**Apple's App Review came back on the new iOS submission asking for standard new-developer proof**: a physical-device screen recording of the full flow, app purpose/audience, setup instructions, external services list, regional-differences confirmation, and regulated-industry disclosure. Drafted the written answers from the actual codebase (Supabase/Kisi/Stripe/Resend/Firebase-FCM/HealthKit/Anthropic-Groq as the real external services; UK-only, no regional variation; not a regulated industry). The recording itself is still outstanding — no Mac/iPhone available this session; walked Carl through borrowing a phone (a business partner's, external TestFlight tester added via `TestFlight → External Testing → Add Tester`, no App Store Connect user role needed) and separately through possibly buying a cheap secondhand iPhone (SE 2020+/8+ — an iPhone 5 was briefly considered and ruled out, tops out at iOS 10.3.4, too old for TestFlight). Apple's ask explicitly requires the recording to start from launch and include login — a first attempt from the business partner missed the login portion and needs a re-take.

**Real bug found and fixed**: a member's confirmation email 404'd (`DEPLOYMENT_NOT_FOUND`) because `request.nextUrl.origin` was baking whatever host the signup request arrived on straight into the emailed confirmation/reset link — and the app's old default `podhq-client.vercel.app` alias is now dead (superseded by the custom domain `www.myfitpod.app`, confirmed live via curl), so anyone reaching the app through that stale link got an unconfirmable account. Added `src/lib/canonical-origin.ts` (`getCanonicalOrigin`) — forces `https://www.myfitpod.app` for any production request regardless of which host it came in on, while leaving local dev/Vercel previews on their own origin — and wired it into `signup/route.ts` and `request-password-reset/route.ts`. **Not yet applied**: the same `request.nextUrl.origin` pattern exists in the three Stripe checkout routes (`checkout`, `checkout-membership`, `checkout-voucher`) and in podHq's own `magic-link/route.ts` — lower risk (short-lived same-session redirects, not long-lived emails) but same bug class; flagged to Carl, not fixed without an explicit ask.

**Update, same day, follow-up session: reply finalized and submitted.** Carl recorded and uploaded the physical-device screen recording himself. The written answers (purpose/audience, setup + demo account, external services, regional differences, regulated-industry) were finalized against the actual codebase and posted as Carl's reply in App Store Connect, plus into the Notes field for future submissions. Corrected along the way: door unlock is **Kisi and PDK (ProdataKey)**, not Kisi alone — PDK-equipped locations (e.g. Brighton) are modelled in the schema already (`access_provider === "pdk"`), though the live unlock call still only talks to Kisi (PDK's own API is the not-yet-built half, per the archived PDK-scouting note). Full list as submitted: Supabase, Kisi + PDK, Stripe (external Checkout, not Apple IAP — Guideline 3.1.3(b)), Brevo (Supabase Auth's SMTP), Resend (per-gym notifications), Firebase Cloud Messaging, HealthKit/Health Connect, Groq/Anthropic Claude.

## Onboarding tour auto-start restored + Supabase test-signup teardown script — 2026-09-15, later same day

**Real regression, not a new bug**: Carl reported "the tour never autostarts" for a new signup. Traced to the 2026-09-02 change (`onboarding-tour.tsx`) that gated the first-login guided tour behind a manual "Show me around" tap inside Pod Assist's welcome chat, instead of the original auto-run-on-first-login behaviour — in practice, most new members just closed that popup without ever tapping through, so the tour effectively stopped running for anyone. Reverted: `TourRunner` now mounts immediately on first login again (`tourStarted` initial state is `firstLogin`); Pod Assist's chat no longer force-opens alongside it (would visually collide with driver.js's own overlay/highlight, which sits above the chat panel's z-index) since the tour's own step 0 popover already carries an equivalent welcome greeting. Pod Assist's icon/label stay mounted regardless, so "Replay app tour" still works later. All element IDs the tour targets (`#tour-greeting` through `#tour-help-label`, across Home/Shop/Book) were independently re-verified present and correctly wired — the bug was purely the auto-start gate, nothing else in the tour pipeline was broken.

**Second, unrelated real annoyance fixed**: Carl testing signup repeatedly kept hitting a wall where deleting his test `members` row didn't free the email up for a fresh signup — `members.auth_user_id references auth.users(id)` has no `ON DELETE`, and neither do ~20 other tables that reference `members.id` (credits, bookings, workout_sessions, coach_conversations, daily_habits, etc.), so the underlying `auth.users` row (and most of a member's data) survives a `members`-only delete regardless. Confirmed custom SMTP (Brevo, set up 2026-08-09/10, project-wide for Supabase Auth's own signup/reset emails, separate from the per-gym Resend config) was already in place, so this was purely the identity-reuse problem, not Supabase's built-in mailer throttle. New `scripts/reset-test-signup-email.sql` (run manually via Supabase's SQL editor, matching this project's other manual-apply scripts): given a test email, finds every table with a `member_id`-shaped foreign key dynamically via `information_schema` (rather than a hardcoded list that would go stale as the schema grows) and deletes all of it, then the `members` row, then `auth.users` itself — `session_replication_role` dropped to `replica` around the actual deletes (reset via an exception handler) as a safety net against transitive FK ordering issues (e.g. `workout_sessions` has both its own `member_id` and a `booking_id` pointing at a `bookings` row this same run also deletes). Hard, irreversible delete with no confirmation step — deliberately scoped to throwaway test emails only, documented in the script's own header.

## PDK auto-link on first unlock, booking-email timezone fix — 2026-09-23

**Steve (Fairford Leys owner) got "Your access isn't set up yet — contact staff" at the door.** `api/unlock/route.ts` required `members.pdk_holder_id`, which only Carl's test account (member 157) ever had, set by hand in podHq's `0100` — every other PDK-gym member was locked out. Now, with no holder ID, the route sends the member's name/email to podHQ's `/api/pdk/unlock`, which reuses their PDK holder by exact email match or creates one, adds it to "Booking Access", unlocks, and returns the ID, saved here even on a failed unlock so a retry doesn't duplicate it. Proxy timeout raised 10s → 25s (a first unlock chains several PDK calls plus one 2s retry). Details in podHq's `ROADMAP_HISTORY.md` #66. **Verified live 2026-09-23 14:49** (member 158, Fairford Leys "Entrance"): PDK's own audit log shows the holder created and added to Booking Access by "Integration Client", then "Access allowed" via API — no manual PDK step, first read succeeded without the retry. Still not built: `members.unlimited_access` (owner unlock without booking, schema only).

**Follow-up, same session**: Carl's first live test hit "Turn on location services" — both Unlock buttons (`upcoming-session-card.tsx`, `bookings-view.tsx`) hard-stopped client-side whenever geolocation failed, even at Fairford Leys, whose resource has no coordinates so the server would never check. Location is now sent when available and omitted otherwise; the server remains the only gate (it still blocks a missing location at resources with coordinates).

**Booking emails showed slot times an hour early** — `formatSlot` in `notifications/templates.ts` had no `timeZone`, and Vercel runs UTC; now `Europe/London`.

**Not a bug**: a Brighton "AAL2 session is required to update email or password when MFA is enabled" reset error was the shared Hove podHQ staff login (2FA-enabled) being entered in the member app. Staff logins reset via podHQ; members should use their own email.

