# PodHQ Client — Pod Booking & Kisi Unlock

Staged build order, same philosophy as `../podHq`'s ROADMAP.md: guide the
user through each stage step by step, ask before proceeding on anything
that could go multiple ways, confirm each stage works before moving to the
next. Don't jump ahead to a later stage unprompted.

Sibling project to `../podHq` (the admin/owner analytics app) — this is the
member-facing PWA: book a pod session, unlock the door via Kisi. Reuses
podHq's Supabase project (same `SUPABASE_URL`/keys) and its dark/gold
Tailwind theme, but is a fully separate Next.js app with its own repo and
deploy. Target scope beyond the pilot (decided 2026-08-06): real members,
Aylesbury Berryfields only — not multi-gym yet.

## Stages

1. **Pilot mechanism proof** (Aylesbury Berryfields, single test account) — done 2026-08-05. Proved booking + Kisi unlock work end-to-end before investing in real auth, payments, or multi-gym support.

   **Kisi integration proven live** — unlock confirmed via Kisi's own activity log, not just a `200 OK` (the API accepting a request doesn't guarantee the physical controller executed it — both were checked separately).

   **`supabase/migrations` live in podHq, not here** (shared Supabase project):
   - `0009_pod_booking.sql` — `gym_kisi_mapping`, `members`, `credits` (append-only ledger, not a mutable balance), `bookings` (60-min slots on the hour, partial unique index so cancelling frees the slot), `pod_access_events` (unlock audit trail).
   - `0010_create_booking_function.sql` — `create_booking()` Postgres function: atomic credit-balance check + booking insert + credit deduction in one transaction, so a booking can never exist without its credit being consumed.

   Pilot member: `pilot-member@example.com`, `member_id` 1, Aylesbury Berryfields, created via `create-pilot-member.mjs` in podHq. App routes: `/login`, `/book` (24hr slot grid, credit balance, book + unlock), `/api/auth/login`, `/api/auth/logout`, `/api/bookings`, `/api/unlock`.

   **Booking flow verified end-to-end through the actual UI**: booked the 13:00 and 15:00 slots, credits deducted correctly. A rapid triple-click on Book was checked directly against the database afterward — only one booking and one credit deduction happened, protected by the DB-level unique index + atomic function, not just client-side disabling.

   **Real Kisi unlock fired twice successfully through the app** (confirmed in `pod_access_events`, not just the response code). **Unlock route hardened**: the Kisi call is now wrapped in try/catch so a failure is always logged with the real reason — found the gap when an unlock attempt failed with literally nothing in the audit log to show for it, because an unhandled exception skipped the logging step entirely.

   **Known open items, not yet resolved:**
   - One unlock attempt failed with no log entry (this was *before* the try/catch fix above, so the real cause was never captured). Never reproduced since the pod was occupied both times we could have retried. Try again once clear — if it fails again, `pod_access_events` will now show the actual reason instead of nothing.

   **Resolved 2026-08-06: unlock duration is 15s, not the intended 10s.** Kisi's own activity log for a real test unlock (see below) showed "unlocked" at 4:33:04 PM and "was locked" (auto re-lock) at 4:33:19 PM — 15 seconds, not the 10s the Relays setting was supposedly changed to. Either that change didn't save or something else is overriding it — worth re-checking the Kisi dashboard's Relays setting directly rather than assuming it's still pending.

   **Kisi key rotation verified live 2026-08-06** (see also the Security note below): after rotating `KISI_API_KEY`, ran a full real test through the actual UI — logged in as the pilot member (password reset via a one-off admin script, since it wasn't known), booked the then-current hour slot, clicked the real Unlock button, and cross-checked two independent sources: this app's `pod_access_events` (`success=true`, `kisi_response="200 OK"`, timestamped 16:33:04 local) and Kisi's own activity log pasted directly by the user (unlock at 4:33:04 PM, auto re-lock at 4:33:19 PM) — timestamps agree exactly. Confirms the rotated key works end-to-end, not just that it was pasted into the right place. Noted in passing: Kisi's log attributes the unlock to "Carl Simpson (admin@myfitpod.co.uk)" — the Kisi account that owns the API key — not the actual member who triggered it via the app; `pod_access_events` (`member_id`/`booking_id`) is the real source of truth for per-member attribution, Kisi's own log can't provide that.

2. **Auth hardening** — login lockout + rate-limiting, reusing podHq's already-debugged patterns rather than re-discovering the same bugs (see podHq ROADMAP Stage 2's MFA/hydration/CSP history for what to watch for). **Mandatory MFA deliberately dropped** (decided 2026-08-06): GymFlow itself has no MFA for members, and requiring it on every gym visit would be real friction for a consumer app, unlike podHq's staff/financial-data context where it's justified. Accepted tradeoff: a compromised password alone is enough to book a slot and unlock the door — nothing else stands in the way — so lockout/rate-limiting (blocking brute-force/credential-stuffing, the more realistic threat than a targeted takeover) stays load-bearing here in MFA's absence, not optional.

   **Login lockout + rate-limiting implemented and live-tested 2026-08-07.** `src/lib/audit.ts` and `src/lib/auth/lockout.ts` port podHq's `auth_events`-backed soft/hard lockout (5 failures/15min → temporary 429, 10 failures since last success → hard 423) minus the MFA/magic-link/admin-reset variants this app doesn't have — same shared `auth_events` table, no new migration needed. `src/lib/rate-limit.ts` ports podHq's `rate_limits`-backed 100 req/min sliding window verbatim, wired into `/api/bookings` and `/api/unlock` (the physical-door route) after the session check. Verified live against the running dev server and the real pilot account: 5 wrong-password attempts logged normally (401, generic message), the 6th correctly tripped the soft lock (429) and held there rather than compounding toward a false hard-lock, and a different email was confirmed unaffected (lockout is scoped per-account, not global).

   **Known gap: no hard-lock recovery path.** Unlike podHq, this app has no admin UI, so there's no `admin_lockout_reset` equivalent — a genuine hard lock (10 failures since last success) currently has no self-service recovery; clearing one means deleting the account's `login_failure` rows from `auth_events` directly in Supabase. Low risk at pilot scale (one member, one of us watching for it), but worth a real fix — likely a password-reset flow — before Stage 5 (real member onboarding) brings in members who can't be manually unstuck this way.

3. **CSP** — own nonce setup, verified against this app's actual script/style needs rather than a blind copy of podHq's `proxy.ts` (podHq's CSP required real, non-obvious debugging work — see its ROADMAP Stage 2 hardening note for the failure mode to watch for: inline hydration scripts silently blocked with zero console warning).

   **Done and live-verified 2026-08-07.** `src/proxy.ts` now generates a fresh nonce per request, threads it via the `x-nonce` header Next reads automatically, and sets a strict CSP on every response path (public, redirect, and authenticated). Simpler than podHq's: no Turnstile/captcha, and no client-side Supabase calls exist in this app (confirmed — no `createBrowserClient`/`NEXT_PUBLIC_SUPABASE*` anywhere), so `connect-src`/`frame-src` need no extra allowances beyond `'self'`. `next.config.ts` picked up the same static security headers (HSTS, X-Frame-Options, etc.) podHq already proved out, and `layout.tsx` got `export const dynamic = "force-dynamic"` so the nonce embedded in Next's inline hydration scripts always matches the one in that request's CSP header. Verified live in Chrome against the actual `/login` page, specifically checking for podHq's exact failure mode: all 11 inline hydration scripts carry the matching nonce, no CSP violations in the console, and the password field genuinely updates on keystroke (proof the `onChange` handler is live, not just server-rendered markup).

4. **Stripe integration** — replaces manual credit grants with real payment-driven credit purchases.

   **Decided 2026-08-09:** hosted Stripe Checkout (redirect to Stripe's page), not embedded Elements — keeps this app's CSP untouched (no `js.stripe.com` script/frame/connect allowances needed, since there's no client-side Stripe.js at all: `/api/checkout` creates a Checkout Session server-side and the browser is redirected to `checkoutSession.url` via `window.location.assign`, which CSP doesn't govern). Credit packages are **placeholder test-mode prices**, agreed to be edited later: `src/lib/credit-packages.ts` — 5/£25, 10/£45, 20/£80 — a single array, not a database table, since editing them is a one-line change per package until there's a reason to make them admin-editable.

   **Plumbing built. Migration applied 2026-08-09** (`0012_stripe_credits.sql` run successfully against the shared Supabase project — `credits.reason` now allows `'purchase'`, unique `stripe_event_id` column in place).

   **Checkout creation + return flow live-tested 2026-08-09** (real test-mode card, `4242 4242 4242 4242`, through the actual `/buy-credits` UI): `/api/checkout` created a genuine Stripe Checkout Session and redirected to Stripe's hosted page; payment completed; Stripe redirected back to `/book?purchase=success`, which loaded normally with the session intact.

   **Bug found and fixed during that test: session cookies were `sameSite: "strict"`, which silently logged the member out on the way back from Stripe.** `SameSite=Strict` cookies are withheld by the browser on a cross-site top-level redirect — exactly what Stripe's return-to-success_url is — so the middleware saw no session and bounced to `/login` instead of `/book`. Changed to `sameSite: "lax"` in both `src/proxy.ts` and `src/lib/supabase/server.ts` (Lax still blocks cross-site POST/CSRF, just not this GET redirect). Confirmed fixed: after the change, the post-payment redirect landed on `/book` with the session intact. **This same class of bug would also have hit any future OAuth-style external redirect** (not just Stripe) — worth remembering if one gets added later.

   Credits correctly did **not** increase from that test purchase — expected, since the webhook path is still unverified (see below), not a bug.

   **Fully verified end-to-end 2026-08-09.** Installed the Stripe CLI (portable binary, no admin rights available in this environment — downloaded directly from Stripe's GitHub releases rather than via winget/choco, extracted to `%LOCALAPPDATA%\stripe-cli`, added to user `PATH`). Ran `stripe login` then `stripe listen --forward-to localhost:3000/api/webhooks/stripe` to get a real `STRIPE_WEBHOOK_SECRET`, added it to `.env.local`. Repeated the test purchase (`4242 4242 4242 4242`, 5-credit package): all five Stripe events (`charge.succeeded`, `payment_intent.created`/`succeeded`, `checkout.session.completed`, `charge.updated`) delivered and returned 200; member's balance went from 4 → 9 credits, confirmed via the actual `/book` UI, not just the webhook's 200. **Idempotency also verified live**: used `stripe events resend` to redeliver the same `checkout.session.completed` event a second time — it returned 200 again but the balance stayed at 9 (not 14), confirming the unique `stripe_event_id` constraint does what it's meant to do against Stripe's real retry behavior, not just in theory.

   Stage 4 is complete. Local dev setup for anyone resuming this: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` must be running alongside `npm run dev` for webhooks to reach the app; the webhook secret it prints changes each time `stripe listen` restarts, so `STRIPE_WEBHOOK_SECRET` needs updating in `.env.local` if that happens.

   New surface: `POST /api/checkout` (session-authenticated like `/api/bookings`, creates the Checkout Session), `POST /api/webhooks/stripe` (no session — Stripe calls this server-to-server, authenticated via Stripe's signature instead; added to `proxy.ts`'s `PUBLIC_API_PREFIXES` so the auth gate doesn't redirect it), `/buy-credits` page + `BuyCreditsList` component, and a "Buy more" link in `booking-grid.tsx`'s header next to the credit count. `/book` shows a one-line success banner on `?purchase=success` (the Checkout success redirect target) — no client-side state needed since the server component re-fetches the balance on that fresh page load.

   Once both manual steps above are done, live-test the same way Stage 1-3 were verified: real test-mode card purchase through the actual `/buy-credits` UI, confirm the webhook fires and `credits` gets a `purchase` row (not just a 200 from Stripe), confirm the balance updates on `/book`, and check a duplicate webhook delivery (Stripe's dashboard can resend an event) doesn't double-credit.

5. **Real member onboarding** — replaces the single hand-created pilot account with an actual signup/invite flow, and adds a self-service password-reset flow (closes Stage 2's hard-lock recovery gap below).

   **Decided 2026-08-09:** open self-signup (email/password + email confirmation), not staff-issued invites — there's no admin UI to build an invite mechanism on top of, and the credit-purchase requirement (Stage 4) already gates actual gym access, so account creation itself doesn't need to be vetted. Every signup is hardcoded to `Aylesbury Berryfields` (`PILOT_GYM` constant in `src/app/api/auth/signup/route.ts`) per this project's single-gym scope.

   **Blocker found and flagged before building:** Supabase's default built-in email service is rate-limited to a handful of emails/hour — fine for the old single pilot account, not for real signup/reset traffic. User confirmed the project is still on default (no custom SMTP configured). **Decided to use Brevo** (already in use elsewhere) — user needs to add Brevo's SMTP relay credentials (`smtp-relay.brevo.com`, port 587, SMTP key from Brevo's SMTP & API settings) in the Supabase dashboard under Authentication → Emails → SMTP Settings. Not yet confirmed done — treat email delivery as unverified until live-tested, same as the Stripe keys pattern.

   **Built:** `/signup`, `/forgot-password`, `/auth/callback` (client page handling both Supabase link shapes — PKCE `code` for signup confirmation, hash-fragment `accessToken`/`refreshToken` for password recovery, mirroring podHq's proven `complete-callback` pattern since this app also has no client-side Supabase calls), `/reset-password`. New API routes: `POST /api/auth/signup`, `POST /api/auth/request-password-reset`, `POST /api/auth/complete-callback`, `POST /api/auth/set-password`. `/login` now links to both. New rate limiting: `checkAuthActionRateLimit` in `src/lib/auth/lockout.ts` (3/email, 10/IP per 15 min) for signup and reset-request — reused `auth_events` counting rather than the `rate_limits` table, since that table's `user_id` is a hard FK to `auth.users` and these actions happen before any account/session exists.

   **Stage 2's hard-lock recovery gap is now closed**, not just worked around: `checkLoginLockout`'s reset-point query now treats a completed self-service password reset (`password_reset_completed` auth event) the same as a fresh `login_success` — mirrors podHq's admin-triggered `admin_lockout_reset`, but member-triggered since this app has no admin UI. A genuinely hard-locked member can now recover on their own via "Forgot password?" instead of needing a manual `auth_events` row deletion in Supabase.

   No migration needed — `auth_events.event_type`'s CHECK constraint was already dropped in podHq's `0006_auth_events_lockout_reset.sql` (validated at the app layer via the `AuthEventType` union instead), so the three new event types (`signup`, `password_reset_requested`, `password_reset_completed`) needed no schema change.

   **Partially live-tested 2026-08-09; blocked on Brevo's daily quota, not a code issue.** Found and fixed two real bugs along the way:
   - `members` insert crashed (foreign key violation, 500) when `signUp()`'s returned `user.id` wasn't real — Supabase's anti-enumeration behavior for an email already registered elsewhere in this shared project (confirmed via `carlsimpson83@yahoo.co.uk`, which already exists as a podHq login) returns a masked "success" whose id was never persisted. Fixed: treat FK violation (`23503`) the same as the existing unique-violation (`23505`) case — both mean "not actually a new member," not an error.
   - Brevo SMTP was initially configured with the **dashboard login** (`admin@myfitpod...`) instead of the dedicated SMTP credentials (SMTP login `xxxxxxx@smtp-brevo.com` + a separate generated SMTP key) — an easy mix-up Brevo's UI doesn't make obvious. `signUp()` failed with `"Error sending confirmation email"` until corrected.
   - After fixing the credentials, one signup (`carlossimpson83+podtest1@gmail.com`) did create a real (unconfirmed) `auth.users` row — confirming the credentials now work — before the account hit Brevo's free-tier daily send limit. Two further attempts failed without even creating a row, an inconsistency worth re-checking once quota resets rather than assuming it's understood.
   - Temporary debug logging left in `src/app/api/auth/signup/route.ts` (server-side console only, clearly marked `TEMP`) to make any future `signUp()` failure visible without weakening the client-facing anti-enumeration message — remove once a full signup→confirm→`/book` walkthrough succeeds.

   **Fully live-tested 2026-08-10, Stage 5 complete.** Brevo's quota reset; ran the full remaining walkthrough against the real running app. Signup → confirmation email → click → `/book` succeeded cleanly (removed the `TEMP` debug logging from `signup/route.ts` per the note above once it did). Forgot-password → reset → sign-in-with-new-password also verified, but only after finding and fixing a real bug: `request-password-reset/route.ts`'s `redirectTo` didn't include `type=recovery`, and Supabase doesn't forward that marker onto our own redirect URL by itself (it only forwards `code`) — so `/auth/callback` couldn't tell a recovery link apart from a signup confirmation and sent users straight to `/book` without ever showing the "set new password" screen, silently leaving the old password in place. Fixed by embedding `type=recovery` directly in the `redirectTo` URL itself, which survives the round-trip. Also confirmed Supabase's own "new password can't match the old one" rejection surfaces correctly as a clean error rather than a silent failure.

   Hard-lockout-clears-on-reset verified too, via a seeded test (real login attempts can't reach 10 failures without waiting through multiple 15-minute soft-lock windows, so a throwaway script inserted 10 backdated `login_failure` rows directly): confirmed the account genuinely hard-locks (423, "This account is locked"), a completed password reset logs `password_reset_completed`, and login immediately works again afterward (401 for a wrong password, not 423) — the reset genuinely resets the failure count rather than just coincidentally timing out.

   One UX gap found and fixed along the way: `/reset-password` had no "confirm password" field, so a typo when setting a new password was silent and only surfaced later as a mysterious login failure (cost real debugging time live before the actual cause — a typo, not a bug — was found). Added a second field with a client-side match check before submit.

6. **Deploy to Vercel** — done 2026-08-09. Separate deployment from podHq, same team (`carl-simpsons-projects-b06f1b22`), live at `https://podhq-client.vercel.app`. Deployed via `vercel --prod` after `vercel link` auto-connected the GitHub repo. Six env vars set in Vercel (Production + Preview): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `KISI_API_KEY`, `STRIPE_SECRET_KEY` (still test-mode — switching to live keys is a deliberate future decision, not part of this deploy), and `STRIPE_WEBHOOK_SECRET` (from a new Stripe webhook endpoint pointing at the production URL, replacing the local `stripe listen` secret). Also added `https://podhq-client.vercel.app/auth/callback` to Supabase's Auth redirect URL allowlist, needed for Stage 5's signup/reset links to work in production.

   **Live-verified end-to-end 2026-08-09**, not just deployed: checked genuine React hydration on `/login` in production first (podHq's own ROADMAP documents a real CSP/hydration failure that only showed up on Vercel, not locally, so this was checked deliberately rather than assumed) — the email field updates on keystroke, confirming real client-side JS, not just static server-rendered markup. Then ran a full real purchase through the actual production UI: logged in as the pilot member, bought 5 credits with the Stripe test card, redirected through Stripe Checkout and back to `/book?purchase=success`, balance went 9 → 14. Confirms the Stage 4 SameSite cookie fix holds in production too, and the new production Stripe webhook is correctly configured end-to-end.

7. **Location-gated unlock** — added to the roadmap 2026-08-09, sequenced after Stripe (Stage 4) at the user's request. Real goal, confirmed with the user: stop a member from unlocking the door remotely for someone who isn't actually with them, not just a soft "you look far away" nudge. **Not yet designed.** Flagged before design starts: the naive approach — reading the browser's Geolocation API and checking distance to the gym — is self-reported by the client and trivially spoofable (devtools location override, GPS-spoofing apps), so on its own it would add a permission prompt without actually closing the hole a motivated member could walk through. Needs a real design discussion before implementation: options worth weighing include Kisi's own proximity/BLE-based unlock (if it exists as an alternative to the REST API this app currently calls) versus accepting some other harder-to-spoof signal, or explicitly documenting this as a deterrent-only control if no tamper-proof option exists at this budget/complexity level. Don't start building against a plain `navigator.geolocation` check without that discussion happening first.

   **Designed, built, and live-verified 2026-08-10 — Stage 7 complete.** Researched Kisi's actual API against this app's architecture: Kisi's own Geofence/Reader-proximity restrictions don't apply to the admin/cloud unlock this app uses at all (per Kisi's docs, those restrictions only gate Kisi's own digital credentials — remote unlock via admin key bypasses them entirely), and genuine BLE Reader proximity would mean per-member Kisi credentials plus a native app (no Web Bluetooth on iOS Safari, Kisi's Tap-to-Unlock SDK is native-only) — a different product shape than a PWA, out of proportion for a single-pod pilot. Turned out to be moot either way: confirmed with the business owner that GymFlow's own app — which existing gym members already use for general door access — uses plain GPS location as a **hard gate** (no access without location on), not BLE/Reader proximity. That's an established precedent already accepted for the whole facility, not just the pod, so built the same kind of check rather than something stronger or weaker.

   `podHq/supabase/migrations/0013_pod_location_gate.sql` — `gym_kisi_mapping` gains `latitude`/`longitude`/`unlock_radius_meters` (seeded for Aylesbury Berryfields: Unit 4, Goodchild Parkway, Sir Henry Lee Cres, HP18 0PE, 300m radius matching Kisi's own default geofence distance), `pod_access_events` gains `reported_latitude`/`reported_longitude`/`distance_meters` so every attempt — blocked or successful — is audited. `src/lib/geo.ts` (Haversine distance), `src/lib/validation/unlock.ts`, and `/api/unlock` now hard-gate on location before ever calling Kisi: missing location or outside the radius returns 403 with a clear message and logs the attempt without touching Kisi's API at all. `booking-grid.tsx`'s Unlock button requests the browser's geolocation first.

   Bug found and fixed before this worked at all: `next.config.ts`'s `Permissions-Policy` header (inherited wholesale from podHq's security headers, back when this app had no location APIs) set `geolocation=()` — disabling the Geolocation API for the entire site at the browser level. Chrome silently blocked every request without ever showing a permission prompt, no error surfaced anywhere. Changed to `geolocation=(self)`.

   Live-verified against the real app: booked a slot, triggered Unlock from a genuinely distant location — correctly blocked (403, "You need to be at the gym to unlock the door"), cross-checked via two independent sources same as Stage 1's key-rotation verification: the `pod_access_events` row (`success=false`, `distance_meters≈15707`, real reported lat/lng) and Kisi's own activity log showing nothing at all for that timestamp, confirming the block happens before any Kisi API call is made, not as a rejection after the fact.

8. **Recurring memberships + real PAYG pricing** — added to the roadmap 2026-08-11 at the user's request, after clarifying the actual model: multiple membership tiers, each granting a fixed number of credits per month, billed recurring; unlock access stays exactly as scoped today (a member's own booking, within its time window — `/api/unlock` already enforced this per-booking gate before memberships existed, and memberships don't change it at all, they only affect how credits land in the ledger).

   **Real pricing sourced directly from GymFlow's own admin catalog** (screenshots provided by the user 2026-08-11), not invented: `src/lib/credit-packages.ts` (PAYG, one-off) now lists the 9 real enabled Credit Pack rows — Intro Pack £54/5, Smart Saver £10.80/1, Train Solo PAYG £13.50/1, PT Pack PAYG £17.50/1, Train With A Friend PAYG £15/1, Train With Your Team PAYG £20/1, PT Pack 10 Sessions £150/10, PT Pack 20 Visits £250/20, PT Pack 30 Visits £300/30 — replacing the Stage 4 placeholder Starter/Regular/Best Value numbers. New `src/lib/membership-tiers.ts` lists the 5 real enabled Membership (Recurring) rows — Smart Save £10.80/mo (1 credit), 5 Sessions £60/mo, 10 Sessions £100/mo, 20 Sessions £180/mo, 30 Sessions £240/mo. Two GymFlow tiers ("Landlord", "Landlord New") were deliberately left out — both disabled on Web/App in GymFlow's own admin panel, reading as internal/staff tiers rather than real member offerings; likewise the disabled duplicate one-off "N Session Pack" credit packs and the £0 "Pay As You Go Entry" row were left out, superseded by their recurring-membership equivalents in GymFlow itself.

   **Built, not yet live-tested:**
   - `podHq/supabase/migrations/0014_pod_memberships.sql` — extends `credits.reason` to allow `'membership'`, and adds a `memberships` table (one row per member — current-state tracking, not an append-only ledger like `credits`: `tier_id`/`tier_name`/`credits_per_period`, `stripe_subscription_id` unique, `status` (`active`/`past_due`/`canceled`), `current_period_end`). **Applied against the shared Supabase project 2026-08-11** — run manually via Supabase's SQL editor, same as 0012/0013 (no CLI/connection string configured in either repo for scripted application). Per this project's shared-schema rule, also flagged in podHq's own ROADMAP.md (Database schema section) so a podHq session isn't surprised by the new table/constraint.
   - `POST /api/checkout-membership` (session-authenticated, same pattern as `/api/checkout`) — creates a Stripe Checkout Session in `mode: "subscription"` with dynamically-priced `price_data` (`recurring: { interval: "month" }`), same "no pre-created Stripe Products/Prices" approach as the existing credit-pack checkout. Blocks a second active membership per member (409) rather than allowing stacked subscriptions — no upgrade/downgrade/cancel flow yet.
   - `POST /api/webhooks/stripe` extended: `customer.subscription.created` inserts the `memberships` row; `customer.subscription.updated`/`.deleted` keep its status/`current_period_end` current; `invoice.payment_succeeded` grants that tier's credits (`reason: 'membership'`) — fires for both the first payment and every renewal, so one handler covers both, idempotent via the same `stripe_event_id` uniqueness Stage 4 already established for one-off purchases. Stripe's `current_period_end` moved to the subscription-item level in this API version (not top-level on the Subscription object) — confirmed directly against the installed `stripe` SDK's type definitions rather than assumed, since guessing wrong here would have silently written `undefined`.
   - `/buy-membership` page + `BuyMembershipList` component, mirroring `/buy-credits`/`BuyCreditsList` exactly. New `IdCardIcon` in `icons.tsx`. `/book`'s credit-balance card gained a "Get a monthly membership instead" link next to the existing "Buy more" credits link; `/book` shows a success banner on `?membership=success` (new query param alongside the existing `?purchase=success`), same server-refetch-on-load pattern as Stage 4.

   **Migration applied 2026-08-11** (see Stage 8 intro above) — confirmed the production endpoint was already correctly scoped to exactly `checkout.session.completed` (the only event the pre-Stage-8 webhook code handled; ROADMAP's earlier "five events" note described local `stripe listen` forwarding everything by default, not the production endpoint's actual configured list). Added the four new event types (`customer.subscription.created`/`.updated`/`.deleted`, `invoice.payment_succeeded`) to the production endpoint via Stripe's Workbench UI.

   **Fully live-tested 2026-08-11, Stage 8 complete.** Deployed (`git push` → Vercel auto-deploy) then ran a real test-mode subscription purchase through the actual `/buy-membership` UI via claude-in-chrome: logged in as the pilot member (password reset via the same one-off script pattern as the 2026-08-06 Kisi test, since it wasn't known), subscribed to Smart Save (£10.80/mo, cheapest tier) with the `4242...` test card, redirected through real Stripe Checkout and back to `/book?membership=success`. Verified directly against Supabase (not just the UI): a `memberships` row landed (tier `smart-save`, status `active`, `current_period_end` correctly one month out) and a `credits` row landed (`+1`, `reason: 'membership'`, real `stripe_event_id`) — balance went 13 → 14 on `/book`, matching. **Idempotency also verified live**, same as Stage 4's original credit-pack test: used `stripe events resend` on the same `invoice.payment_succeeded` event — redelivered successfully, but the credits table still showed exactly one `membership` row afterward, not two, confirming the `stripe_event_id` uniqueness holds for subscription credits the same way it already did for one-off purchases.

   **Extended verification 2026-08-11, at the user's prompting** (asked directly whether it was reasonable to leave the other four tiers untested — the honest answer was no, since a per-tier data-entry typo in `membership-tiers.ts` wouldn't have been caught by testing only one tier). Re-checked all 4 remaining tiers' prices against the original GymFlow screenshots (all correct — credits-per-period stays a documented inference from the "N Sessions" naming, GymFlow's admin table never exposed a raw credits column to verify against). Then bought a second real tier (10 Sessions Per Month) to exercise a genuinely different code path — a member switching tiers, not just a first purchase.

   **Real bug found by that second purchase, fixed same session:** the `credits` row granted correctly (+10, `reason: 'membership'`), but the `memberships` table kept showing the *old, already-canceled* Smart Save row — no row for the new subscription at all. Root cause: `memberships.member_id` is `unique` (one row per member), but `customer.subscription.created`'s handler did a plain `insert()`. A member's genuinely *new* subscription after cancelling their first hits the exact same 23505 conflict a *retried webhook delivery* of the same event would — and the code treated both identically, silently dropping the new subscription's data as "just a retry." Worse than a display bug: the "already have an active membership" 409 check reads this same table, so a member could have stacked a second real subscription while the DB still showed their membership as canceled. Fixed by switching to `.upsert(..., { onConflict: "member_id" })` so a new subscription replaces the stale row instead of silently no-op'ing.

   **Fix verified live**: cancelled the test subscriptions via `stripe subscriptions cancel` (confirmed `customer.subscription.deleted` correctly flips `memberships.status` to `canceled` — that path uses `.update().eq('stripe_subscription_id', ...)`, unaffected by the same bug), then bought a third tier (20 Session Pack). The `memberships` row (same `id`, not a duplicate) correctly updated to the new tier, new `stripe_subscription_id`, `status: active`, refreshed `current_period_end` — confirmed directly against Supabase, not just the UI. Also incidentally confirmed live along the way: the duplicate-membership 409 block correctly fires with a real second subscribe attempt while one's still active (no Stripe redirect happened at all).

   **PAYG pricing also live-verified 2026-08-11** (asked about directly — the credit-pack pricing update earlier in this stage had been deployed but never actually purchased, same unverified-data-entry risk as the membership tiers had). Cross-checked all 9 `credit-packages.ts` rows against the GymFlow screenshots again: exact match, no transcription errors. Bought Smart Saver (£10.80, 1 credit) for real through `/buy-credits` — Stripe's own Checkout page showed the correct "Smart Saver — 1 credit, £10.80" and a one-off "Pay" button (not "Pay and subscribe", confirming `mode: "payment"` as intended, not `"subscription"`), redirected to `/book?purchase=success`, and a new `credits` row landed (`+1`, `reason: 'purchase'`) — confirmed against Supabase, not just the redirect. The underlying checkout/webhook code for this path was already proven in Stage 4 and didn't change here, only the data did, so one purchase was enough to close the gap (unlike memberships, where a second purchase surfaced an actual code bug in new logic).

   **Re-verified again 2026-08-11** after the upsert fix + `auth_events` index migration, this time buying a different pack (Intro Pack, £54/5 credits) to broaden coverage beyond the single-credit packs — correct Checkout copy, redirected to `/book?purchase=success`, credits row landed (`+5`, `reason: 'purchase'`) confirmed against Supabase. Two of nine PAYG packs now individually purchase-tested (Smart Saver, Intro Pack); the remaining seven share the exact same code path with no pack-specific branching, same reasoning as the membership tiers.

   **Re-verified live 2026-08-11** after the deploy that fixed the upsert bug and the `auth_events` index migration — subscribed to 5 Sessions Per Month (the one remaining individually-untested tier) through the actual `/buy-membership` UI. `memberships` row correctly updated in place (same row, new tier/subscription/credits), balance went 45 → 50. That's now 4 of 5 tiers individually purchase-tested end-to-end (Smart Save, 10 Sessions, 20 Session Pack, 5 Sessions) — only 30 Sessions hasn't had its own purchase, low risk given every tier runs through identical code with no tier-specific branching. Test subscription cancelled afterward, pilot account left clean.

   **Still not done, flagged rather than silently skipped:**
   - No cancel/upgrade/downgrade UI — a member can't change or cancel their tier from within this app yet; cancelling currently means going direct to Stripe's dashboard (or the CLI, as used for this testing).

## UX & performance polish (2026-08-10)

Not a formal stage — ad-hoc review requested once Stages 1-7 were all live-verified, comparing this app against GymFlow's own member app (white-labeled "My Fit Pod - Aylesbury") for consistency, plus a first performance pass.

**Performance:** production build inspected — client bundle is a normal Next.js baseline (~1.2MB static, framework/polyfill chunks in the expected range), nothing bloated. Confirmed `layout.tsx`'s `force-dynamic` (needed for the CSP nonce, Stage 3) doesn't add meaningful render overhead itself — local requests to `/login`/`/signup`/`/forgot-password` all completed in single-digit milliseconds. The real lever identified: `/book` does two independent Supabase Auth round-trips per load (`proxy.ts` middleware's `getUser()` plus `book/page.tsx`'s own `getUser()` — intentional defense-in-depth per this repo's own security rule, not something to remove) on top of its own DB queries (already parallelized via `Promise.all` for credits + bookings). No `vercel.json` existed, so Vercel was defaulting serverless functions to `iad1` (US East).

**Resolved 2026-08-10:** user confirmed both Supabase's project and (after changing it) Vercel's function region are now London. Added `vercel.json` pinning `regions: ["lhr1"]` so every request's Vercel↔Supabase hop stays in-region instead of round-tripping to the US. Verified live post-deploy: production `X-Vercel-Id` header on `/login` reads `lhr1::lhr1::...`, confirming the pin actually took effect, not just that the file was pushed.

**UX pass 1, compared against GymFlow's app screenshots the user provided:**
- `/book` no longer renders past hourly slots for other members — previously a flat 24-row list starting at `00:00`, meaning anyone opening the app after breakfast scrolled through 10+ dead "Past" rows to reach anything bookable. Now filtered out entirely (a past slot stays visible only if it's the viewing member's own booking, e.g. still mid-unlock-window). `booking-grid.tsx`.
- Added a Show/Hide password toggle, matching GymFlow's login screen — new shared `src/components/password-input.tsx`, wired into `/login`, `/signup`, and `/reset-password`.
- `/buy-credits` cards now have names (Starter / Regular / Best Value) instead of a bare credit count, matching GymFlow's Credit Packs card pattern (name, price, detail line) — `credit-packages.ts` gained a `name` field per package; Stripe's checkout line-item name updated to `"{name} — {label}"` so receipts stay descriptive.

**Full redesign, 2026-08-10 — three iterations before landing.** User's reaction to pass 1 above ("still looks shit") triggered a proper structural redesign, not just spot-fixes:
1. First attempt: full layout redesign (hero banners with icons, spacious cards) but kept the existing dark/gold theme throughout — rejected, too far from GymFlow's actual look.
2. Second attempt: a black-header + white-content "sheet" split (rounded overlap between the two, gold accent retained for buttons/prices/links) — also rejected ("horrible"). Re-examining GymFlow's actual screenshots at this point revealed the real gap: GymFlow is essentially monochrome black/white with no accent color at all, and its header has a flat bottom edge, not a rounded overlapping sheet.
3. Landed version: flat dark header (title + icon, `bg-card`, no gradient tint) flowing directly into a flush white content area — no rounded overlap. Buttons are solid black (`bg-card-light-foreground`) or black-outlined, not gold. Text, prices, and links on the white areas are black, not accent-colored. The dark page chrome itself stays (required — CLAUDE.md: dark-only theme, no light mode, shared with podHq), but color usage within it now matches GymFlow's near-total monochrome rather than leaning on the gold brand accent.

New shared components: `src/components/page-hero.tsx` (banner used by every auth page and `/buy-credits`) and `src/components/icons.tsx` (small inline SVG set — Lock/Calendar/Coin/UserPlus — no new dependency). `globals.css` gained `card-light`/`card-light-border`/`card-light-foreground`/`card-light-muted` tokens for the white content surfaces, kept separate from the existing dark `card`/`card-glass` tokens rather than replacing them, since the dark hero/header still uses those.

Applied across `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/book`, `/buy-credits`. Not done: GymFlow's bottom nav bar and native app chrome (Home/Book/Shop/Profile tabs) — this app only has the two real destinations (`/book`, `/buy-credits`) behind auth, so a persistent tab bar wasn't part of what was asked for.

## Security review + live pentest — 2026-08-11

At the user's request: a code-level review of every API route plus careful
live testing against production (`podhq-client.vercel.app`), deliberately
bounded to avoid any real-world side effect — no attempt to actually
trigger a Kisi unlock or lock out a real account, given the physical door
and shared-account stakes.

**Nothing exploitable found.** Verified live: every protected page/API
route correctly blocks unauthenticated access (middleware redirect before
app logic runs); a forged Stripe webhook (fake signature, and no signature
at all) is rejected outright, nothing processed; no service-role/Stripe/
Kisi secret anywhere in client-visible output; sensitive paths
(`/.env`, `/.git/config`, `/api/admin`) just redirect, nothing served; no
`Access-Control-Allow-Origin` header (no cross-origin API access); login
returns the identical generic error for a nonexistent email as for a real
one with a wrong password (no enumeration); malformed JSON handled
gracefully, no stack traces leaked; HSTS/nonce-CSP/`X-Frame-Options: DENY`/
`nosniff`/restrictive `Permissions-Policy` all correctly present.
`/api/unlock` is structurally IDOR-proof — it never accepts a client-
supplied member/booking ID, always derives the caller's own active booking
from their session.

One low-severity, not-worth-fixing-yet note: `style-src` in the CSP allows
`'unsafe-inline'` (a common Tailwind tradeoff) — real risk is low, only
matters if there's ever an HTML-injection point elsewhere.

**Performance:** found `auth_events` (queried on every login/signup/reset
attempt, both apps) had no index at all on `ip_address` and an existing
index that didn't cover the `event_type` filter every query applies — a
growing full-table-scan risk. `podHq/supabase/migrations/0015_auth_events_perf_indexes.sql`
**applied 2026-08-11** via Supabase's SQL editor, same manual step as prior
migrations (no standing DB write access, by design, see the earlier
"safety issue with giving up access to Supabase" discussion).

## Activity removed, real Bookings page added — 2026-08-11

Direct, blunt feedback on the redesign above: the credit-history
"Activity" section was "made up and shit," and Profile's "Bookings" row
should lead to a real bookings list — upcoming sessions plus a past-
sessions selector — not just dump the member back on `/book`'s day-picker
(which is for creating a *new* booking, not reviewing existing ones).

Removed Activity entirely, including the now-unused `getCreditHistory`/
`CreditHistoryRow` from the data layer (Profile was their only consumer —
no dead code left behind). New `/bookings` (Profile's "Bookings" row now
points here instead of `/book`): an Upcoming/Past toggle, each listing the
member's own sessions with date and time, past ones also showing status
(Completed/Cancelled/No-show — falls back to the DB's literal "Booked"
status for a past slot nothing ever explicitly changed, an honest
reflection of what's actually stored rather than inventing a "Completed"
assumption). New `getAllMemberBookings(memberId)` fetches every booking
in one query and splits it into upcoming/past client-side by time and
status, rather than building a fragile PostgREST OR-filter string for a
second query.

**Live-verified**: Activity confirmed gone from Profile; `/bookings`
Upcoming tab correctly showed "No upcoming sessions" (accurate — the pilot
account's real bookings are all from earlier in the week); Past tab
correctly listed all 7 real historical bookings (5-10 Aug, correct dates/
times, newest first, all labelled "Booked" since none were ever
cancelled/no-showed).

## Profile redesign + calendar fixes — 2026-08-11

Two rounds of direct feedback on the work above, addressed the same
session.

**Profile didn't match GymFlow's actual layout** ("doesn't look anything
like GymFlow's") — the first pass only matched the general dark-header/
light-content pattern used everywhere else in this app, not GymFlow's real
Profile structure. Rebuilt to match: an avatar-initials + name/gym card,
then grouped icon+chevron list sections mirroring GymFlow's own ACCOUNT/
BOOKING pattern (Account: Memberships/Credit Packs/Gift Voucher; Booking:
Bookings). Deliberately did **not** fabricate rows for GymFlow features
this app has no backing functionality for (Wallet, Payment Methods,
Invoices, Notifications, Language, Waiver & Terms, Access, Change Club,
Appointments) just to look more complete — a dead link would be worse
than an honestly shorter menu. Credit history (real content this app has
that GymFlow's own Profile menu doesn't show) kept as an additional
"Activity" section. Log Out restyled to GymFlow's red icon+text treatment.
Also fixed a real bug caught while touching this file: `credits.reason`'s
TypeScript union was missing `'gift_voucher'` (added to the DB migration
and webhook in the gift-voucher work but never added to this shared
type) — `tsc` caught it immediately once the redesign referenced it.
Live-verified against production: avatar/name/gym card, membership CTA,
all list rows, and Log Out all render and match correctly.

**Calendar feedback, sent mid-session while the above was still being
verified**: "the weekly calendar needs to be scrollable and needs to have
some sort of month identifier." Both were real gaps — at 8 days the strip
never actually overflowed its container on a normal screen width, so
"scrollable" had nothing to scroll to, and there was no month label
anywhere near the strip itself (only buried in the day-heading below).
Fixed: extended `BOOKING_WINDOW_DAYS` from 8 to 30 (book up to a month
ahead), added a month/year label above the strip computed from the
*selected* day (not a static "today's month" label) so it correctly
updates if the 30-day window is scrolled across a month boundary. Found
one more real gap live-testing this fix: landing directly on a date
outside the strip's default view (e.g. a bookmarked `?date=` URL, or
Home's own upcoming-booking link) left the strip showing its unscrolled
start with the actual selection off-screen to the right, no visual hint
you needed to scroll to find it — fixed with an auto-scroll-into-view
effect keyed on `selectedDate`.

**Live-verified**: confirmed via direct JS inspection that the strip
genuinely overflows now (`scrollWidth` 1702px vs `clientWidth` 448px —
previously the 8-day version fit inside its container with nothing to
scroll), navigated to `2026-09-05` and confirmed the month label correctly
read "September 2026" (not stuck on August), and confirmed the auto-scroll
fix by re-testing the same URL after deploying it — the strip now lands
centered on "SAT 5" instead of showing the unscrolled Aug 11-18 view with
the real selection invisible off-screen.

## Bottom nav, membership upgrade/downgrade, gift vouchers — 2026-08-11

Requested together, worked on together, while the user was away from a
laptop — built and deployed incrementally (commit → push → deploy →
verify → next), same discipline as every other stage, just without a
live pause for confirmation between each one.

**Bottom nav (Home/Book/Shop/Profile).** New `BottomNav` component, fixed,
active-state highlighting, added to Home/Book/Shop/Profile only (not the
auth pages, not the buy-credits/buy-membership/gift-voucher sub-pages
reached through Shop — those keep the existing "Back to X" link pattern).
New Home page (`/`) replaces the old plain redirect-to-`/book`: greeting,
"Get Your Membership" CTA when none active, next upcoming booking (new
`getNextUpcomingBooking` data helper) or a book-now shortcut. New Shop
page (`/shop`) mirrors GymFlow's own Shop screen exactly (Memberships /
Credit Packs / Gift Voucher cards). The header icons on `/book`,
`/buy-credits`, `/buy-membership` (the ones flagged as "don't do
anything" earlier) now link to `/profile`.

*Verification note*: screenshot capture repeatedly glitched during this
build (viewport height reported inconsistently across calls — 772/726/702/
638px — and once showed a stray black bar mid-scroll). Rather than trust a
possibly-broken screenshot, checked the nav's actual computed styles
directly via JS (`position: fixed`, `bottom: 0px`, bounding rect correctly
spanning to `window.innerHeight`, no `transform` on any ancestor breaking
the fixed-positioning containing block) and its accessibility tree (all 4
links present with correct `href`s) — both confirmed it was built
correctly; the screenshot tool just wasn't rendering it visibly in this
particular automation environment. Home and Shop pages did render
correctly in screenshots and were visually confirmed.

**Membership upgrade/downgrade.** `/api/checkout-membership` now
distinguishes re-selecting the *same* tier (still blocked, 409 "You're
already on this plan") from a genuinely *different* tier (a real switch):
cancels the existing subscription immediately via
`stripe.subscriptions.cancel()` — same behaviour as Profile's own Cancel
button, no proration/credit for the unused period — then proceeds to
create the new Checkout Session exactly as a fresh subscribe would. The
`memberships` row itself isn't touched directly by this route; the
existing `customer.subscription.deleted` webhook handler remains the sole
writer for that state change. `BuyMembershipList` shows "Current plan"
(no button) on the active tier and "Switch to this plan" on the others.

**Live-verified end-to-end** through the actual UI: subscribed to Smart
Save, then clicked "Switch to this plan" on 10 Sessions — confirmed via
Supabase that the old subscription was cancelled *before* the new
Checkout Session was even created (not just eventually), then completed
the new payment and confirmed the same `memberships` row (not a
duplicate) updated to the new tier/subscription/credits, `status: active`.
UI correctly showed "Current plan" on the new tier afterward, with the
same-tier 409 path now structurally unreachable through the UI (no button
rendered for the tier you're already on). Test subscription cancelled
afterward.

**Gift vouchers.** New Shop item matching GymFlow's own Gift Voucher
screen: preset amounts (£20/50/100/150, matching GymFlow's exactly) plus
a custom amount (£10–£500 range, guards the dynamic Stripe price against
trivial/absurd amounts). The code (`XXXX-XXXX`, alphabet excludes
visually-ambiguous characters since it's read off a screen and typed back
in) is generated at Checkout-creation time — before payment — so the
success page can show it immediately with no race against the webhook,
but it's only ever written to the new `gift_vouchers` table once the
webhook confirms payment (`checkout.session.completed`); an abandoned
checkout leaves nothing spendable behind. Redemption
(`POST /api/vouchers/redeem`, UI on `/buy-credits` — the closest thematic
fit) claims the voucher via an atomic conditional update
(`.is("redeemed_by_member_id", null)`) so two simultaneous redemption
attempts for one code can't both succeed, then grants credits.

**Deliberate simplifications, flagged rather than silently applied:**
- **No email sending.** This app has no outbound-email infrastructure of
  its own (Supabase Auth's emails are a separate system, confirm/reset
  only). Unlike GymFlow's own flow, the code isn't emailed to the
  purchaser — it's shown directly on the success page with a copy button,
  and passing it on to whoever the gift is for is the purchaser's own
  job. A real fix needs a decision on email infrastructure (which
  provider, API key) not made here.
- **£10 = 1 credit conversion rate**, chosen as the best (cheapest) rate
  across the current PAYG packs in the absence of a single canonical
  £-per-credit rate to derive it from — worth confirming with the
  business rather than treating as final.
- **Redemption is two separate writes** (claim the voucher, then insert
  the credits row), not one atomic transaction/RPC like `create_booking`
  has. The claim step is itself race-safe, but if the credits insert
  failed right after a successful claim, the voucher would show
  redeemed with no credits granted — a low-probability, not-yet-seen
  edge case, not a security hole (can't double-grant), just a
  worth-knowing gap in front of real usage.

**Migration applied and full loop live-verified 2026-08-11**, after the
user ran `0016_pod_gift_vouchers.sql` via Supabase's SQL editor. Bought a
real £20 voucher through `/gift-voucher` with the Stripe test card
(`4242...`), redirected to the success page showing a real code
(`MKBU-2RTN`) — confirmed against Supabase, not just the UI, that the
webhook actually wrote the `gift_vouchers` row (`credits: 2`, correct
£10-per-credit rate, unredeemed). Redeemed it on `/buy-credits`: voucher
flipped to `redeemed_by_member_id` set, and a `credits` row landed
(`+2`, `reason: 'gift_voucher'`) — balance confirmed via direct query.
**Double-redeem also verified live**: replaying the same code against
`/api/vouchers/redeem` correctly returned 409 ("already been redeemed")
and the credits table still showed exactly one grant, confirming the
atomic `.is("redeemed_by_member_id", null)` claim holds under a real
repeat request, not just in theory. Stage 9 (gift vouchers) is now fully
closed — Stripe checkout/webhook/redeem all confirmed working end-to-end
against production.

## Profile page — 2026-08-11

Prompted by a full GymFlow app walkthrough (Home, Classes, Shop, Profile
screens) — asked directly what to prioritize given the size of the gap
between podhq-client (three pages, no nav, no account hub) and GymFlow's
full structure. Recommended Profile over a bottom nav: it closes real
*functional* gaps, not just navigation — there was no way to log out from
the UI at all (the `/api/auth/logout` route existed, nothing linked to
it), and no way to see or cancel a membership once bought (flagged as a
gap right after Stage 8 shipped).

Built: `/profile` — membership status card (tier, credits/period, renewal
date, Cancel button) or a "Get a membership" prompt if none active; last
20 credit-ledger entries with friendly reason labels (Credit pack
purchase / Membership renewal / Booking / etc.); a Log out button.
`POST /api/membership/cancel` calls `stripe.subscriptions.cancel()`
directly (immediate, not `cancel_at_period_end` — matches the exact
behaviour already live-verified during Stage 8's own testing) — the
`memberships` row itself isn't touched by this route; the existing
`customer.subscription.deleted` webhook handler remains the sole writer
for that state change, same pattern as every other Stripe-driven update
in this app.

**Also closed the icon complaint from earlier**: the decorative header
icons on `/book`, `/buy-credits`, and `/buy-membership` (flagged as
"don't do anything") now link to `/profile` — `/book`'s calendar icon
swapped for a new `UserIcon` (calendar didn't represent "profile"
meaningfully), and `PageHero` (shared with the *unauthenticated* auth
pages) gained an optional `iconHref` left unset there, so login/signup/
forgot-password keep their purely-decorative icon rather than linking
into a profile that doesn't exist pre-login.

**Live-verified** (local dev, via claude-in-chrome) — with a real
detour: initial testing accidentally landed on a leftover session for
`carlossimpson83+podtest2@gmail.com` (member "Pod Test", last signed in
2026-08-10) still valid in the local Chrome profile's cookies, which
`proxy.ts` was silently honouring — the *new* login attempts weren't
actually failing, they were never being submitted at all, since the
already-valid old session redirected `/login` straight to `/book` before
the form mattered. Diagnosed by checking `members`/`auth.users` directly
rather than assuming the new code was broken. Logged out properly first
(a real functional test of the new Log Out button — worked, redirected
to `/login` cleanly), then re-verified under the actual pilot account:
correct name/gym, "No active membership" (accurately reflecting the
Stage 8 cancellation testing), and the full, correctly-labelled,
newest-first credit history matching every real transaction from
today's testing. Deployed to production and sanity-checked there too.

## Week-day toggle on /book — 2026-08-11

Requested with a real reference screenshot this time (GymFlow's "Classes"
screen: a horizontal Tue 11 → Tue 18 day strip, today highlighted, above a
day-scoped session list). Closed a real gap this surfaced: `/book` had
never supported viewing or booking any day but today — Stage 1 only ever
built a same-day grid.

Built to match: `src/lib/booking-dates.ts` (shared date-window logic —
today + the next 7 days, matching the reference), `getTodaysBookings`
renamed to `getBookingsForDate(gym, date)` and parameterized instead of
hardcoded, `/book?date=YYYY-MM-DD` drives which day's slots the server page
fetches. `BookingGrid` gained the day-strip UI (Link-based, not client
fetching, so the existing session-verified server-render path handles
auth/data the same way it always has) and a day heading ("Wednesday 12
Aug"). `key={formatDateParam(selectedDate)}` on `<BookingGrid>` forces a
clean remount on day change — without it, the client component's
`useState(initialBookings)` would only ever pick up its *first* mount's
data and go stale across a same-route search-param navigation, a real
Next.js App Router pitfall caught before it shipped, not after.

The existing past-slot-hiding and unlock-window logic already compared
against absolute timestamps rather than "today" specifically, so both
generalized to future days for free — a future day's slot is never
"past," and an existing booking on a future day correctly shows no active
Unlock button until its actual time window arrives. `parseDateParam`
clamps any hand-edited `?date=` outside the real 8-day window back to
today, so the URL can't be used to request a date the UI itself never
offered.

**Live-verified** (local dev, via claude-in-chrome): day strip renders
matching the reference exactly; clicking Wed 12 correctly navigated,
re-fetched, and displayed all 24 hours from 00:00 with no past-hiding
(confirming the future-day logic) and the correct "Wednesday 12 Aug"
heading; credits balance held steady across the navigation (no state
loss). Deployed to production and sanity-checked there too. Booking
*creation* itself wasn't touched — only which day's slots are displayed —
so it wasn't re-tested end-to-end; the underlying `create_booking` RPC and
credit-deduction path are unchanged from their existing Stage 1 testing.

**Day-strip scroll UX, 2026-08-11.** Two rounds of direct feedback:
first, "get rid of the sliding bar and just have it so their fingers can
scroll" — the strip was always natively touch/trackpad-scrollable via
`overflow-x-auto`, but the visible scrollbar track read as its own UI
element rather than a swipeable row. Added a `.scrollbar-hide` utility
(`scrollbar-width: none` + WebKit's `::-webkit-scrollbar`) so it now
behaves like a plain strip. Second, "needs to scroll upto a month in
advance" — the 30-day window was already there (confirmed: 30 day pills,
last one Sep 9, `scrollWidth` 1702 vs `clientWidth` 448), but hiding the
scrollbar removed the only way a plain desktop mouse (no touchscreen, no
trackpad swipe) could actually reach it — dragging the old scrollbar
thumb no longer had anything to grab. Added pointer-based click-and-drag
scrolling for mouse input specifically (touch/trackpad already work
natively and are left alone), with the standard drag-then-click
suppression so releasing a drag on top of a day pill doesn't accidentally
navigate to whatever date it happened to end on.

**Live-verified** (local dev, via claude-in-chrome, synthetic pointer
events since there's no real mouse/touchscreen in this environment):
confirmed `scrollbar-width: none` applied and the strip still scrolls
(`scrollLeft` moves) with the bar hidden; confirmed a simulated mouse
drag reaches the maximum `scrollLeft` (1254, the full 30-day range) from
a cold start; confirmed a drag that ends on top of a day pill correctly
suppresses that pill's navigating click (URL stays put); confirmed a
separate, genuine click on a different pill immediately after still
navigates normally (`?date=2026-08-26`) — the fix needed one iteration
here: the first version cleared the drag-suppression flag only inside the
click handler itself, which left it wrongly "stuck true" if a drag ended
over the strip's padding instead of directly on a pill (no click fires
there to consume it), silently swallowing the next unrelated click.
Fixed by clearing the flag on a deferred timer after every pointer-up
instead, so it always resets even when no click follows the drag.

## Cross-app account collision — found and partially fixed 2026-08-11

Signing into podhq-client with `carlsimpson83@yahoo.co.uk` (a real podHq
staff/admin login) succeeded at the Supabase Auth level — both apps share
one Auth project — but hit a bare "No member profile found for this
account." dead end, since that email had never been through podhq-client's
own signup. Separately, trying to fix that by signing up again with the
same email sent no confirmation email at all: Supabase's anti-enumeration
behaviour for `signUp()` against an email that already exists **anywhere**
in the shared project returns a masked "success" and sends nothing — the
Stage 5 signup-crash fix (23503 handling) already documented this exact
email as the collision case, but only stopped it from erroring, never gave
a path to actually become a member.

**Fixed (UX):** the dead-end message (copy-pasted across `/book`,
`/buy-credits`, `/buy-membership`) replaced with a shared
`NoMemberProfile` component that explains the likely cause and links to
`/signup`.

**Deliberately not fixed (signup auto-link):** considered making signup
detect "email already exists elsewhere" and silently attach a member
profile to it instead of no-op'ing — rejected. Supabase sends no
confirmation for that case, so auto-linking would mean anyone who merely
knows someone's email address (not their password) could get a member
profile linked to that person's real account with zero verification.

**Admin-mediated fix instead**, same category as `reset-pilot-password.mjs`:
`podHq/link-existing-account-as-member.mjs <email> [name]` looks up an
existing auth user by email and inserts the `members` row directly (no new
credentials, no email sent) — used live to link
`carlsimpson83@yahoo.co.uk` (`member_id` 12). Fine at pilot scale (one or
two known collision cases); would need a real verified-link flow (e.g. a
confirmation email specifically for "link this existing account to a
member profile") before this could happen at real signup volume.

**Real verified-link flow built and live-verified 2026-08-11**, closing
the gap above. `/api/auth/signup` now checks `admin.auth.admin.listUsers()`
for the email *before* calling `signUp()` (same lookup the manual scripts
already used). A genuinely new email takes the unchanged normal signup
path. A colliding email instead calls `supabase.auth.signInWithOtp({
email, options: { shouldCreateUser: false, emailRedirectTo } })` — this
sends a real magic-link email even for an existing user (unlike `signUp`'s
silent anti-enumeration path), so clicking it proves the requester
actually controls that inbox before anything is linked; `shouldCreateUser:
false` guarantees this branch never mints a new `auth.users` row. The
client-facing response (`GENERIC_MESSAGE`) is byte-identical in both
branches — no new enumeration vector, only the real server-side action
differs. New `POST /api/auth/link-existing-account`, called from
`/auth/callback` once the magic link has established a session, creates
the `members` row (idempotent — a repeat click is a no-op, checked live).

**Real bug found and fixed during live-testing**: the callback page
originally read its own routing marker via `hashParams.get("type") ??
searchParams.get("type")` — but Supabase always stamps its own `type`
into the hash on every magic-link callback (e.g. `"magiclink"`), which
silently shadowed the query string's `type=link_existing` before the
check ever ran, so the link-existing-account step never fired. Password
recovery only ever worked by coincidence: Supabase's own hash type for
*that* flow happens to literally be `"recovery"`, matching the app's own
marker by accident. Fixed by moving this flow onto a dedicated `mode`
query param that Supabase never touches, instead of overloading `type`.

**Live-verified end-to-end against production**: created a throwaway auth
user (`podhq-client-link-test@example.com`, not yet a podhq-client member
— simulating a real podHq-side account), called the real `/api/auth/signup`
endpoint with that email and confirmed (a) the generic message came back
unchanged and (b) no member row was created yet; confirmed via
`auth_events` that the collision branch fired (`link_existing_requested`).
Since there's no real inbox to click from this environment, generated a
valid magic-link token via `admin.auth.admin.generateLink()` and completed
the round-trip manually (Supabase's own `redirect_to` handling on that
admin-generated link proved unreliable to script against directly — it
kept falling back to the project's default Site URL regardless of what was
passed — so the resulting valid access/refresh tokens were carried by hand
to the real production callback URL instead, exercising 100% of the actual
application code, just not Supabase's own email-redirect construction
specifically). Landed on `/book` as "Hi Flow Test"; confirmed directly
against Supabase that the `members` row was created correctly
(`auth_user_id`, `gym: 'Aylesbury Berryfields'`, `name: 'Flow Test'`) and
`account_linked` was logged. Re-called `link-existing-account` a second
time and confirmed exactly one member row still existed — idempotency
holds. All test fixtures (auth user, member row, audit events) deleted
afterward.

`podHq/link-existing-account-as-member.mjs` stays in place as a manual
fallback for edge cases the self-service flow can't reach (e.g. an email
that needs linking but genuinely never receives the magic link).

## Pod capacity + bookable hours (podHq admin backend) — 2026-08-11

Requested alongside the account-linking flow above: staff need to
manually book members and configure per-gym limits from podHq (the
staff/admin app), not just via podhq-client's own self-service flow. Full
build lives in podHq (`/pods` page, `src/lib/data/pods.ts`, `/api/pods/*`)
— see its own ROADMAP.md Stage 15 for that side. This app's half is the
self-service-side plumbing the new limits actually apply to.

**`podHq/supabase/migrations/0018_pod_capacity_and_hours.sql` written
2026-08-11, not yet applied** (per the shared-schema rule, documented on
both sides): adds `pod_capacity`/`open_hour`/`close_hour` to
`gym_kisi_mapping` and rewrites `create_booking()` to enforce capacity
itself (serialized via `pg_advisory_xact_lock`) instead of the old
partial unique index, which hard-capped every gym at exactly one
concurrent booking. Every existing gym keeps `pod_capacity = 1` by
default, so no real behaviour changes until this is applied and a gym is
explicitly reconfigured via podHq's `/pods` page.

**Confirmed with the user**: bookable hours are a self-service-only
restriction (staff can override from `/pods`); capacity is a hard
physical constraint that applies no matter who's booking.

**Changes made here**: `src/lib/data/member.ts` gained `getPodConfig(gym)`
(reads `open_hour`/`close_hour`/`pod_capacity`, defaulting to today's
original behaviour — all-day, capacity 1 — if a gym has no
`gym_kisi_mapping` row). `/api/bookings` now rejects a self-service
booking outside the configured hours (400, "That time is outside booking
hours") and handles the new `slot_full` RPC error (409, "That slot is
fully booked") alongside the existing `insufficient_credits` case.
`booking-grid.tsx`'s day-grid now filters out-of-hours slots entirely
(members never see a slot they can't book) and is capacity-aware rather
than binary taken/free — a slot only shows "Booked"/"Full" once its
booking count reaches `podCapacity`, with an `n/capacity` count shown
once capacity is above 1.

**Real bug found and fixed before this shipped**: the hours check
initially read the slot's hour via a plain `new Date(...).getHours()` on
the server — but Vercel's serverless functions run in UTC internally
regardless of the `lhr1` region pin (the region only controls *where* the
function executes, not its OS timezone), so during BST (British Summer
Time — in effect right now) this would have been off by exactly one hour
against the UK wall-clock hours staff configure in podHq's `/pods`. A
9am–9pm gym configuration would have silently opened/closed an hour late
every day in summer. Fixed using `Intl.DateTimeFormat` with
`timeZone: "Europe/London"` to read the hour correctly regardless of the
server's own timezone. The client-side filter in `booking-grid.tsx`
doesn't have this problem — it reads the hour from a `Date` constructed
in the member's own browser via `setHours()`, which is already correctly
timezone-aware for whoever's holding the phone.

**Fully live-tested 2026-08-11 against production**, after the user
applied the migration. Set Aylesbury Berryfields' hours to a deliberately
narrow 10:00–12:00 window and logged in as the pilot member: `/book`
correctly rendered only the 10:00 and 11:00 slots (nothing outside the
window shown at all, not just disabled); a direct `fetch` to `/api/bookings`
for a 14:00 slot (bypassing the UI filter entirely) was correctly rejected
server-side (400, "That time is outside booking hours") — confirms the
`Europe/London` timezone fix actually works correctly in production during
real BST, not just in theory; booking the in-window 10:00 slot succeeded
normally. Reset hours back to the default (all-day) and re-tested a normal
booking to confirm no regression: all 24 hourly slots rendered as before,
and a 09:00 booking succeeded exactly as it always has. All test bookings
and their credit rows deleted afterward, gym config reset to defaults.

Capacity enforcement and its concurrency-safety were verified DB-side
directly against the shared `create_booking()` RPC — see podHq's
ROADMAP.md Stage 15 for that testing (default capacity correctly blocks a
second booking, raising it to 2 allows one more and blocks a third, and
two simultaneous booking attempts for the same slot at capacity 1 correctly
resolve to exactly one winner, not both). The self-service day-grid's
capacity-aware rendering (`booking-grid.tsx`) wasn't separately re-tested
against a live capacity>1 gym in the UI — no real gym has been configured
above the default of 1 yet — but it's the same `bookings` data already
exercised by every other live booking test this session, just filtered
differently.

## Load/scaling review — 2026-08-11

Prompted by the user's stated goal of eventually replacing GymFlow
entirely, not just running the Aylesbury pilot — asked directly what
could go wrong under real load and whether that was worth worrying about
yet ("its not like amazon is it"). Agreed the actual traffic shape here
is bursty-but-bounded (gym rush hours across up to 9 gyms), not
continuous high-volume traffic, so the useful checks are the specific
contention points this app actually has, not generic load-testing
infrastructure. Three checks run:

1. **Concurrency at the one real contention point** — the shared
   advisory lock in `create_booking()` (Stage 15). Fired 25 simultaneous
   `create_booking()` calls at the same slot (capacity 1): exactly 1
   succeeded, 24 correctly got `slot_full`, confirmed against the DB
   (exactly 1 `booked` row, not more), 703ms total for all 25 to resolve.
2. **Raw throughput/connection handling** — 50 simultaneous
   `create_booking()` calls across 50 different slots (no lock
   contention): all 50 succeeded, zero connection/timeout errors, 1268ms
   total. No access to Supabase's actual billing-plan connection cap from
   here, but this is a more useful empirical signal anyway — a burst well
   beyond any single gym's real rush hour produced no pool exhaustion.
3. **Code-level pass for the boring-but-real scaling killers** — checked
   every data-layer query in `src/lib/data/member.ts` (plus the new
   `src/lib/data/pods.ts` in podHq) for unbounded row fetches, the same
   class of bug podHq's own ROADMAP already documents as a real
   historical incident (PostgREST silently truncates any single request
   past 1000 rows, no error). Found two:
   - `getCreditBalance()` fetched every row of a member's credit ledger
     and summed in JS — `credits` is append-only (one row per booking/
     purchase/renewal), so a multi-year active member's row count isn't
     bounded, and a silent truncation here means a **wrong balance**, not
     just an incomplete list. **Fixed**: moved the sum into Postgres via
     a new `get_credit_balance()` RPC (`podHq/supabase/migrations/
     0019_get_credit_balance_function.sql`, applied 2026-08-11) — same
     pattern `create_booking()` already used internally for its own
     balance check, returns one number regardless of ledger size.
   - `getAllMemberBookings()` (the `/bookings` history page) had the same
     unbounded pattern. Lower stakes — an incomplete list, not wrong
     money — fixed with a `.limit(500)` cap (most-recent-first, already
     the query's sort order), well beyond what the current flat-list UI
     is realistically useful for browsing.
   - Flagged but not fixed: `getMembersForGym` (podHq's new `/pods`
     manual-booking member picker) has the same unbounded shape, per gym
     rather than per member. Real risk is much further off (needs ~1000+
     members at a *single* gym) and the impact if it ever hit would be a
     dropdown missing entries, not a financial bug — a searchable/
     paginated picker is a real UX change to make once member counts
     actually approach that, not now.

**Live-verified**: `get_credit_balance()` applied via Supabase's SQL
editor; called it directly against the pilot member's real ledger (member
1, 20 real rows) and confirmed it returned 67, exactly matching what the
old JS-summed method computed from the same rows — correct now, not just
"correct at scale" in theory. Deployed the code change and confirmed
production `/book` still shows 67 credits through the new RPC-backed path,
not the old one. All load-test fixtures (75 throwaway members/users across
both concurrency tests) deleted afterward; the real gym's `pod_capacity`/
`open_hour`/`close_hour` config was untouched by this review (only touched
during the earlier hours-enforcement test, already reset then).

## Access onboarding (mobile/gender, address, waiver) — 2026-08-11

Built at the user's request: a new "Access" row under Profile's ACCOUNT
section, forcing a 3-step flow before the physical door Unlock is usable —
`/access` (mobile number + gender) → `/access/address` (home address) →
`/access/waiver` (My Fit Pod's real Terms & Conditions, House Rules, and
the Waiver clause, with a typed-name signature).

**Migration**: `podHq/supabase/migrations/0017_pod_member_access.sql` adds
8 nullable columns to `public.members` (`mobile_number`, `gender`,
`address_line1/2`, `address_city`, `address_postcode`,
`waiver_signed_name`, `waiver_signed_at`) — no CHECK constraint on gender,
validated at the app layer via a fixed option list instead, same pattern
as podHq's `gym_outgoings.category`. **Written but not yet applied** — per
this project's standing rule, migrations are user-applied via Supabase's
SQL editor, not run by Claude directly. Documented on both sides per the
shared-schema-duplication rule: this file and podHq's own ROADMAP.md.

**Gating scope confirmed by the user 2026-08-11**: Unlock-only, as built —
only the physical door Unlock is gated on completion (`isAccessComplete()`
in `src/lib/data/member.ts`); booking a slot and buying credits/membership
remain unaffected. No code change needed, this closes the earlier open
flag.

**Waiver content is real, not placeholder** — transcribed in full from the
user's own PDF (`My Fit Pod Ts & Cs (2).pdf`, provided directly for this
purpose) into `src/lib/waiver-terms.ts`: General, Eligibility, PT Terms,
Account Registration, House Rules (YOU WILL / YOU WILL NOT), Access
Details Policy, Damages, Payment Terms, Memberships, Cancellation Policy,
Licensing/Copyright, User Content, IP, Application License, SMS Messaging,
Third-Party Services, Indemnity, Disclaimer, the Waiver clause itself,
Limitation of Liability, Facility Rating, Promotion Terms, Notices,
Governing Law, Termination, General — rendered in full on `/access/waiver`
above the signature field, not summarised or truncated.

**Defense in depth on the door, same pattern as the Stage 7 location
gate**: `booking-grid.tsx`'s Unlock button is replaced with a "Complete
Access" link to `/access` when incomplete (client-side UX), and
`/api/unlock` independently re-checks `isAccessComplete()` server-side and
logs a `pod_access_events` row (`success:false`,
`"blocked: access onboarding incomplete"`) before ever reaching the
location gate or Kisi — never trusts the client-side check alone for the
physical door.

`npx tsc --noEmit` and `eslint` pass on all new/changed files (one
pre-existing, unrelated `Date.now()` purity lint warning in
`booking-grid.tsx` predates this change).

**Fully live-tested 2026-08-11 against production**, after the user applied
the migration via Supabase's SQL editor. Real bug found and fixed during
this test: the UK mobile number regex only accounted for 10 digits after
the leading 0, one short of a genuine UK mobile (`07xxx xxxxxx` = 11
digits total) — every real number was rejected as invalid until fixed
(strips whitespace, checks digit count directly). Ran the complete flow
through the actual UI (via claude-in-chrome against
`podhq-client.vercel.app`, form values set through React's native input
setter + dispatched `input`/`click` events since programmatic clicks on
this page needed a render tick before state changes were visible —
verified directly against the DOM rather than trusting screenshots, which
glitched repeatedly this session same as during the bottom-nav build):
Step 1 (mobile + Male) → Step 2 (address) → Step 3 (full waiver text
rendered — confirmed all 25 clauses present including Clause 18 WAIVER —
signed "Pilot Test Member", checkbox agreed) → redirected to
`/profile?access=complete`, Access row flipped from "Action needed" to
"Complete". Confirmed directly against Supabase: all 8 fields correctly
persisted on the pilot member's row, not just reflected in the UI.

Then booked the current hour and unlocked for real from `/bookings`
(browser's `navigator.geolocation.getCurrentPosition` overridden to
Aylesbury Berryfields' real coordinates in devtools — the same
spoofing technique this app's own location gate is explicitly documented
as unable to stop, used here deliberately to test the app rather than
defeat it): `pod_access_events` shows `success:true`,
`kisi_response:"200 OK"`, `distance_meters:0`, confirming the Access gate
correctly let a fully-onboarded member's real Kisi unlock through rather
than blocking it. The negative path (blocking an access-incomplete member)
wasn't separately live-fired to avoid touching the pilot account's now-
complete state, but the code is the same `isAccessComplete()` boolean gate
already proven live in the location-gate's identical pattern, checked
before ever reaching Kisi.

**Unlock relocated to /bookings, 2026-08-11** — asked directly where the
Unlock control should live once Access existed as a separate section
("the access bit or through your bookings"); user picked Bookings. Moved
the entire Unlock flow (geolocation request, `/api/unlock` call, Access-
gate prompt) from `booking-grid.tsx`'s inline day-grid onto
`bookings-view.tsx`'s Upcoming tab, next to the actual booking it belongs
to, rather than mixed into the day-grid used for creating new bookings.
`/book` now just shows a "Unlock from Bookings" link on your own slot
during its unlock window, no button. Also fixed a related gap while moving
this: the Upcoming/Past split previously flipped a booking to "past" the
moment its slot's start time passed — meaning it vanished from Upcoming
(and therefore from any chance to unlock) right as a member arrived for
their session. Now a booking stays "upcoming" through the end of its own
65-minute unlock window, matching the actual window `/api/unlock` enforces
server-side, not just the raw slot start. `/api/unlock` itself is
unchanged — it never cared which page called it.

## Deliberate pilot-scope simplifications still open (Stages 2-6 above close these)

- Single pod, single gym — no multi-pod capacity logic exists. Out of scope even after Stages 2-6 (target is still Aylesbury-only, not multi-gym) — revisit only if the target scope changes.
- No password-reset flow, so no self-service recovery from a Stage 2 hard lockout (10 failures since last success) — clearing one today means deleting the account's `login_failure` rows from `auth_events` directly in Supabase. Low risk at pilot scale (one member, one of us watching for it). Closed by Stage 5.

## Kisi ↔ gym-name mapping gotcha (see gym_kisi_mapping)

Kisi's place names don't match podHq's `Revenue.gym` strings 1:1. Confirmed
live: Kingston, Basingstoke, Milton Keynes, Berkhamsted, and Aylesbury all
have a Kisi place; Crewe and Hackney do not — confirmed with the business
owner that those two run on a separate access-control system entirely, not
Kisi. Oxford East is also absent from Kisi with no explanation confirmed
yet. One Kisi place, "Thomley," doesn't correspond to any of the 9 gym
names — unresolved, possibly Oxford East under a different name, not
verified.

## Tooling decision — 2026-08-11

User pointed to two external Claude Code skill repos (`garrytan/gstack` and
`nextlevelbuilder/ui-ux-pro-max-skill`) and asked whether they fit this
project. Evaluated, **not installed**:

- **gstack** — 23-skill sprint-pipeline framework (CEO/QA/security personas,
  Playwright automation, its own persistent knowledge DB). Too much surface
  for this project's existing tight staged-ROADMAP workflow with manual
  live-verification per stage.
- **ui-ux-pro-max-skill** — auto-generates a new design system per request
  from industry presets; confirmed (from its own docs) to have no way to
  constrain output to an existing theme and no clarifying-question step
  before generating. Would fight this app's CLAUDE.md rules (dark-only, no
  light mode, reuse podHq's existing tokens) and the actual UI work done
  here, which is pixel-matching GymFlow's specific look, not generating a
  novel palette.

Kept only as a reference note (not installed, not auto-invoked) in case a
future task genuinely needs one — e.g. a from-scratch design system with no
existing theme to match, or heavier multi-agent orchestration than
`/code-review`/`/security-review` already cover.

## Security note — resolved 2026-08-06

A prior session's note here claimed the Kisi API key was accidentally
pasted into chat during this project's setup. The user disputed that this
happened, and no Claude session present for that conversation could
verify it either way — a search of this codebase found no trace of the
actual key value anywhere (only the non-secret `kisi_place_id`/
`kisi_lock_id` numeric IDs are committed, in `0009_pod_booking.sql`).
Regardless of whether the original claim was accurate, the user rotated
the key in the Kisi dashboard and updated `KISI_API_KEY` in `.env.local`
as a precaution (2026-08-06). The rotated key's actual value was never
read here (`.env.local` is hard-blocked, see both projects'
`.claude/settings.json`), but its function was verified live the same
day — see Stage 1's "Kisi key rotation verified live" note above. Fully
closed.

## Cancel session, 2-hour policy — 2026-08-12

Built at the user's request: members had no way to cancel a booking once
made (`/bookings` only ever offered Unlock). Policy confirmed by the
user directly: cancelling within 2 hours of the session forfeits the
credit outright, no refund; cancelling earlier than that refunds it.

**`podHq/supabase/migrations/0020_cancel_booking_function.sql` written and
applied 2026-08-12** (per the shared-schema rule, flagged on both sides —
see podHq's own ROADMAP.md Database schema section). New
`cancel_booking(p_member_id, p_booking_id)`: locks the booking row
(`for update`) so a rapid double-click can't race past the status check
and double-refund, same atomicity concern `create_booking()` already
solves with its advisory lock. Ownership is enforced by the query itself
(`where id = p_booking_id and member_id = p_member_id`) — `p_member_id`
is always the caller's own session-derived id, never client-supplied,
same IDOR-proof pattern `/api/unlock` already uses. Refund uses
`credits.reason = 'booking_refund'`, which has been in the allowed-reason
check constraint since 0009_pod_booking.sql but was never actually used
until now.

**Built**: `POST /api/bookings/cancel` (session-authenticated,
rate-limited under its own `/api/bookings/cancel` bucket, same pattern as
every other route) maps `booking_not_found` → 404 and `already_cancelled`
→ 409. `bookings-view.tsx`'s Upcoming tab gained a "Cancel session" link
per booking that expands to an inline confirmation panel (no native
`window.confirm` — this app avoids browser dialogs elsewhere too) stating
up front whether this specific cancellation will refund or forfeit the
credit, computed client-side from the same 2-hour cutoff the DB function
enforces server-side (a hint only — the RPC is the real check). On
confirm, the booking is optimistically hidden from Upcoming and
`router.refresh()` re-fetches from the server, matching the existing
optimistic-update pattern already used for membership cancellation on
`/profile`.

Migration applied 2026-08-12 via Supabase's SQL editor, same manual step
as every prior migration in this project — first attempt hit a syntax
error (`42601`, `if` unexpected on line 3) because only part of the
function body made it into the editor on the first paste; re-pasting the
full statement in one go (`create or replace function` through the final
`$$;`) fixed it. `npx tsc --noEmit` and `eslint` pass on all new/changed
files (the one pre-existing, unrelated `Date.now()` purity lint warning in
`bookings-view.tsx` predates this change — confirmed via `git stash` that
it was already present before any of today's edits).

**Fully live-tested 2026-08-13 against local dev, cancel-session feature
complete.** Ran the full flow through the actual UI (via claude-in-chrome
against `localhost:3000`, pilot member's password reset via the same
one-off script pattern as prior stages since it wasn't known) and
cross-checked every result directly against Supabase, not just the UI:
- Booked 08:00 (51 min out, inside the 2-hour cutoff) and 12:00 (well
  outside it) on the pilot account, credits 66 → 65 → 64.
- Cancelled 08:00: confirmation panel correctly read "This is within 2
  hours of your session, so your credit will not be refunded — you'll
  lose it," balance stayed at 64 after confirming — verified against
  `credits` directly, only the original `booking_used` row exists for
  that booking, no refund row.
- Cancelled 12:00: confirmation panel correctly read "This is more than
  2 hours away, so your credit will be refunded," balance went 64 → 65 —
  verified a matching `booking_refund` (+1) row landed against that
  booking's id.
- Double-cancel: replayed `POST /api/bookings/cancel` for the same
  now-cancelled 12:00 booking — correctly rejected 409 ("That booking
  can't be cancelled"), balance held at 65 via `get_credit_balance()`,
  confirming the row-lock guard holds against a real repeat request, not
  just in theory.

One rough edge hit during this test, not a bug in the app: clicking
"Sign in"/"Book" via synthetic click events at fixed coordinates
intermittently didn't fire the underlying React handler at all (no
network request sent), matching this session's earlier note about
programmatic clicks needing a render tick — switched to ref-based
element clicks (`read_page` → click by ref) instead of raw coordinates,
which worked reliably every time after that.

**Deployed to production and re-verified there 2026-08-13** (`vercel --prod`,
aliased to `podhq-client.vercel.app`). Repeated the exact same three-part
test against the live site instead of local dev: refund case, forfeit
case, and a double-cancel replay of the same booking id — all three
matched local dev exactly, each cross-checked directly against Supabase
(`booking_refund`/`booking_used` rows and `get_credit_balance()`), not
just the UI. Cancel-session is now live-verified in both environments.

**Small UX gap found and fixed while testing**: on `/book`, a slot
showing "Your booking" was plain static text — the only way to reach that
booking's cancel/unlock controls was navigating to `/bookings` separately,
even though the booking was right there on screen. Made "Your booking" a
link to `/bookings` (`booking-grid.tsx`), matching the existing
"Unlock from Bookings" link's styling/target directly below it. Live-
verified locally: clicking it lands on `/bookings` with that exact
session's card visible, `Unlock`/`Cancel session` both present.

## Staff refunds (podHq side) — webhook + redemption changes, 2026-08-14

Triggered by a question in podHq about whether that app needed its own
Stripe integration — the real answer turned out to be refunds
specifically, not general reporting (podHq already reads this app's real
purchase data straight out of the shared Supabase project). The staff-side
UI, `/api/pods/refund`, and its data layer all live in podHq — see its own
ROADMAP.md Stage 17 for that half. This app's half is the webhook
plumbing that half depends on.

**Real gap found first**: nothing this app ever wrote captured the actual
Stripe payment/charge reference — only `stripe_event_id` (the webhook
event id), which isn't enough to call `stripe.refunds.create()`. Fixed by
`podHq/supabase/migrations/0026_stripe_refunds.sql` (written, not yet
applied) adding `stripe_payment_intent_id` to `credits` and
`gift_vouchers`, `'refund'` to `credits.reason`, and `refunded_at` to
`gift_vouchers`.

**`src/app/api/webhooks/stripe/route.ts` changes**:
- `checkout.session.completed`'s credit-pack and gift-voucher inserts now
  capture `checkoutSession.payment_intent`.
- `invoice.payment_succeeded`'s membership credit grant needed real
  research, not a guess: confirmed against the installed Stripe SDK's type
  definitions that `Invoice` has **no direct `payment_intent` field** in
  this API version — it was replaced by the Invoice Payments API. Fixed by
  calling `stripe.invoicePayments.list({ invoice: invoice.id })` and
  taking the default payment's reference, same "confirm against the SDK's
  actual types, don't assume" discipline Stage 8's `current_period_end`
  gotcha already established for this file.
- New `charge.refunded` handler — the sole writer of the ledger
  correction for a staff-issued refund, same webhook-driven pattern every
  other money event here already uses (podHq's refund route only ever
  calls Stripe, never touches the ledger directly). Looks up the charge's
  `payment_intent` against `stripe_payment_intent_id`: a matching
  `purchase`/`membership` credits row gets a negative `reason: 'refund'`
  row inserted (idempotent via `stripe_event_id`, same as every other
  insert in this file); a matching gift voucher gets `refunded_at` set
  (atomic `.is("refunded_at", null)` update, same claim pattern as
  redemption). **Partial refunds aren't supported** — only a
  fully-refunded charge (`charge.refunded === true`) is processed; a
  partial refund is logged, not silently treated as a full reversal.
  Staff only ever issues full refunds from podHq's side, so this wasn't
  built out further.

**`src/app/api/vouchers/redeem/route.ts`**: now also rejects an
already-refunded code (`refunded_at` set), folded into the same atomic
claim update that already guarded against double-redemption, so a code
staff has just refunded can't still be redeemed by whoever's holding it.

**`0026_stripe_refunds.sql` applied 2026-08-14.** `npx tsc --noEmit` and
`eslint` pass on all changed files.

**Fully live-verified end-to-end, same day, once the two remaining manual
steps closed** (restricted `STRIPE_SECRET_KEY` added to podHq's env,
`charge.refunded` added to the production webhook's event list — see
podHq's own ROADMAP Stage 17 for the full account, including two
unrelated real bugs found and fixed along the way: a Stripe-key swap
between the two apps' `.env.local` files, and podHq's own refund-feature
commit having never been deployed). A real test purchase through this
app's Stripe Checkout correctly captured `stripe_payment_intent_id`; the
staff refund issued from podHq produced a genuine `charge.refunded`
webhook here, which correctly wrote the `-1 reason: 'refund'` ledger row
matched to the original purchase by payment intent — confirmed directly
against the database, not just a 200 response.

## Booking automations: first-session guide, low-credits nudge, win-back — 2026-08-14

Requested at the user's prompting ("give this to 10 members to test") while
scoping a beta rollout — the notification system already covered purchases
and cancellations but not these three. Checking the actual code before
building (not assumed) surfaced that far more already existed and was
already live than the user believed: `booking_confirmed`,
`booking_cancelled`, and all four purchase/membership confirmation emails
were already wired up and firing, not just the waitlist one.

**1. First-booking access guide** — `bookingConfirmedEmail` (`src/lib/notifications/templates.ts`)
gained `isFirstBooking`/`accessComplete` params, adding a bullet-point
guide only on a member's genuine first booking (checked via a count query
in `src/app/api/bookings/route.ts`, excluding the just-created row):
complete Access onboarding if not already done (with an explicit note that
the door won't unlock until it is — `isAccessComplete()` already gates
`/api/unlock`, confirmed by reading that route rather than assumed),
turn on Location Services, then Bookings → Unlock. Real flow verified
against the actual `bookings-view.tsx` unlock button before writing the
copy, not guessed.

**2. Running low on credits** — deliberately event-driven (checked right
after a booking's credit deduction) rather than a scheduled sweep, since
the state change that matters already happens at a single point.
`LOW_CREDITS_THRESHOLD = 1` fires the nudge once, when a booking leaves
exactly 1 credit remaining.

**3. Win-back (`/api/notifications/win-back`, new Vercel Cron, daily 9am UTC)** —
genuinely needed a scheduled job, so it follows the existing
`waitlist/expire` cron's exact pattern (`CRON_SECRET` bearer auth,
paginated queries — same 1000-row PostgREST cap lesson podHq's Revenue
queries learned). Finds members whose most recent qualifying booking
(`booked`/`completed`, not `cancelled`) is more than 21 days old and nudges
them once, deduped against `notification_log` so nobody gets renudged
inside 30 days. A member whose latest booking is 21+ days old can't also
have a future one booked (a future slot_start would itself be more recent
and become their "latest"), so no separate upcoming-booking check is
needed.

`appUrl()` (previously private to `waitlist/offer-next.ts`) moved to
`notifications/core.ts` and is now shared by all three call sites rather
than reimplemented.

**Real, separate bug found while testing, not by the user**: the very
first live test of the new win-back route returned the login page's HTML
instead of a JSON response. Root cause: `proxy.ts`'s auth gate redirects
any request with no session cookie to `/login` unless its path is in
`PUBLIC_API_PREFIXES` — and neither `/api/notifications/` nor
`/api/waitlist/` was ever in that list. A Vercel Cron invocation has no
session cookie at all, so **this wasn't just a bug in the brand-new
win-back route — the pre-existing `waitlist/expire` cron had the identical
problem and had likely never actually executed since it was built**,
despite `vercel.json` scheduling it daily since. Fixed by adding
`/api/waitlist/expire` (that specific route only, not the whole
`/api/waitlist/` prefix — `/api/waitlist` itself and its `[id]/accept`
`[id]/decline` siblings are real member actions and must stay
session-gated) and `/api/notifications/` to `PUBLIC_API_PREFIXES`.
Re-verified live after the fix: win-back now returns real JSON
(`{"status":"ok","checked":0,"sent":0}`, correctly finding no genuinely
inactive members in current data) instead of HTML, a bad bearer token
correctly gets `401`, and — the real proof this had been silently broken
— re-running `waitlist/expire` for the first time post-fix immediately
processed **5 genuinely stale offers** that had been sitting unactioned.

**Also confirmed, not assumed, while discussing this with the user**: a
waitlist offer's slot is genuinely protected from being booked out from
under the offeree during their 15-minute window — `create_booking()`
(`0024_waitlist.sql`) checks for an active, unexpired offer on that exact
gym+slot before allowing anyone else to book it, raising `slot_reserved`
if the caller isn't the offeree, all inside the same advisory-lock
transaction the capacity check already uses. Nothing needed fixing here;
this was a "verify the existing design holds" question, not a gap.

**Verified live**: booking a session as a real test member (zero prior
bookings, credits adjusted to land exactly on the low-credits threshold)
correctly triggered both `booking_confirmed` (with the full bullet-point
guide, including the Access-incomplete warning, since this test member
genuinely had none of that completed) and `credits_low` in the same
request; both delivered through Resend with real provider message IDs.
Rendered HTML content checked directly in Resend's dashboard, not just
assumed correct from the template code. One separate, real deliverability
observation caught in passing: both bounced when sent to a plus-addressed
Yahoo test address (`user+test@yahoo.co.uk`) despite the bare address
delivering fine minutes earlier for an unrelated test — most likely the
sending domain's youth/reputation rather than anything in this app, not
chased further, worth revisiting if real members on Yahoo report missing
emails. `npx tsc --noEmit` and `eslint` pass clean on every file touched.

**Also found and fixed the same day, a step up from these three
features**: `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` were entirely absent
from Vercel production (confirmed via `vercel env ls production`), meaning
every notification this whole system has ever tried to send in
production — waitlist offers included — had been silently failing (the
fire-and-forget design swallows the error on purpose, so nothing surfaced
until `notification_log` was checked directly). Both added to Vercel
Production + Preview and to local `.env.local`; confirmed present in
Vercel afterward.

## PWA: installable + basic offline/flaky-signal support — 2026-08-15

Closes the real gap behind podHq's Stage 11 PWA descope note: PWA behaviour
belongs here (the member-facing app), not podHq's own admin dashboard.
Found three concrete gaps on inspection rather than assuming "PWA" meant
one thing: `manifest.webmanifest` had `"icons": []`, nothing in
`layout.tsx` actually linked the manifest or an apple-touch-icon into the
page `<head>`, and `sw.js` only ever handled push notifications — no
offline/flaky-connection behaviour at all despite members using this at
the gym on mobile data.

**Icons + manifest linking.** Generated `icon-192.png`/`icon-512.png`/
`apple-touch-icon.png` via `sharp` from podHq's existing
`public/logo-mark.png` — its black background actually suits this app
(manifest `background_color`/`theme_color` are already `#000000`/
`#0a0a0b`), the inverse of the clash that same asset caused in podHq's own
now-light-themed sidebar. `manifest.webmanifest`'s `icons` array and
`layout.tsx`'s `Metadata.manifest`/`Metadata.icons` fields both filled in;
verified live via the actual rendered `<head>` (not just that the files
exist) — `<link rel="manifest">`, both `<link rel="icon">` sizes, and
`<link rel="apple-touch-icon">` all present and 200-ing.

**Offline/flaky-signal support**, scoped after checking with the user
specifically because of poor gym-floor signal, not just full offline: a
new `sw.js` fetch handler (GET, same-origin only, `/api/*` explicitly
skipped so auth/session/payment/booking calls never get intercepted or
served stale) does cache-first for the static shell
(`/_next/static/*`, `/icons/*`, `/manifest.webmanifest`) and, for page
navigations, races the real network fetch against a 4s timeout — on a
dead or merely slow connection the cached version (or the new `/offline`
page as a last resort) is served immediately rather than making the
member stare at a spinner or a browser connection-error page, while the
real fetch keeps running in the background to refresh the cache for next
time. `/offline` (`src/app/offline/page.tsx`) is a small static,
auth-agnostic page precached at install time. The service worker itself
is now registered unconditionally on every page load
(`src/components/register-service-worker.tsx`, mounted in `layout.tsx`)
rather than only when a member opts into push — `subscribeToPush`'s own
`register()` call is unaffected, since registering the same script URL
twice is a no-op against the existing registration.

**Real bug caught before it shipped**: `/offline` was returning a 307 to
`/login` — `proxy.ts`'s auth gate treats every path as protected unless
explicitly allowlisted, and `/offline` wasn't in `PUBLIC_PATHS`. Left
unfixed, this would have broken precaching outright (the service worker's
`cache.addAll` at install time would get a redirect response back instead
of the real page) and, worse, put a logged-out member with dead signal
into a redirect loop instead of ever seeing the fallback. Added `/offline`
to `PUBLIC_PATHS`; confirmed live afterward (200, no `Location` header).

**Verified live end-to-end**, not just via file inspection: registered
service worker confirmed `activated` in a real browser session; the
precache (`caches.keys()`/`cache.keys()`) held exactly the four expected
URLs after first load. Then the actual dev server process was killed
(genuinely unreachable, not a simulated flag) and a fresh navigation to
`/profile` — a page never previously visited in that session, so nothing
page-specific was cached for it — correctly rendered the real `/offline`
fallback content instead of a browser error. Server restarted afterward
and the same navigation immediately went back to serving live, real
server-rendered content (confirming the network-first race doesn't leave
anything stuck showing stale/cached data once connectivity returns).
`npx tsc --noEmit`, `eslint`, and `next build` all pass clean on every
file touched — the two `Date.now`-purity errors `eslint` reports
(`booking-grid.tsx`, `bookings-view.tsx`) are pre-existing and untouched
by this work.

## OWASP Top 10 audit fixes — 2026-08-16

Same session as podHq's own audit-remediation pass (see its ROADMAP for
the full cross-repo picture) — a general audit across both repos ahead of
switching Stripe to live keys, not scoped to any single feature.

**High: service worker cached authenticated page HTML, never purged on
logout — cross-user leak on shared devices.** The Stage above's
`navigationHandler` cached *every* successful navigation response
regardless of content, including `/profile` and `/bookings`, both of
which server-render a member's own name/gym/membership/booking history.
`api/auth/logout` only called `supabase.auth.signOut()` — never touched
the cache. On a shared/kiosk device, if the network happened to hit the
4s timeout right after a new member logged in, they could be served the
*previous* member's cached profile/bookings page. Fixed two ways:
`sw.js`'s `navigationHandler` now only ever writes to the cache for a
small allowlist of genuinely public routes (`/`, `/login`, `/signup`,
`/forgot-password`, `/reset-password`, `/offline`) — every personalized
route is fetched live, never cached, never served stale on a timeout;
`CACHE_VERSION` bumped to `v2` so existing installs purge their old,
now-suspect cache on next activation; and `profile-view.tsx`'s `logout()`
additionally calls `caches.delete()` on every `podhq-client-*` cache
directly, for immediate effect rather than waiting on the next SW
activation cycle.

**High: unsanitized member name injected into staff-facing HTML
emails.** `src/lib/validation/auth.ts`'s signup `name` field has no
character restriction, and flowed unescaped into `templates.ts`'s HTML
bodies — most dangerously `staffNewSignupEmail`/
`staffMembershipCancelledEmail`/`staffGiftVoucherPurchasedEmail`, sent to
gym owners/admins, where a name containing markup could render as a real
link/image, a phishing vector against staff inboxes. Added an
`escapeHtml` helper, applied to every interpolated member-supplied name
in every email body (not subject lines — those are plain JSON fields to
Resend's API, not raw HTML, so escaping there would just show literal
`&amp;`-style entities).

**Medium: both cron routes' secret check failed open if `CRON_SECRET`
itself was unset.** `waitlist/expire` and `notifications/win-back` both
did `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` — if the env
var were ever missing, that becomes a literal string comparison against
`"Bearer undefined"`, which a request could just send. Both routes now
check `cronSecret` is actually configured first and fail closed (500) if
not, same pattern `/api/unlock` already used for `KISI_API_KEY`.

**Medium: `/api/notifications/` was allowlisted as an entire public
prefix, not one route.** `proxy.ts`'s `PUBLIC_API_PREFIXES` included the
whole `/api/notifications/` path, so any future route added under it
would skip the session-auth gate by default. Only `win-back` exists
today; narrowed to an exact-path allowlist (`PUBLIC_API_EXACT_PATHS`)
covering it and `waitlist/expire` specifically, so a new route has to
opt in rather than inherit public access silently.

**Medium: rate limiter had a read-then-write race.** `checkRateLimit`
did a separate `select` then `update` — two concurrent requests in the
same window could both read a count under the limit and both increment,
letting a burst modestly exceed `LIMIT_PER_MINUTE`. Replaced with a call
to a new `increment_rate_limit` Postgres function (defined in podHq's
`supabase/migrations/0034_increment_rate_limit.sql` per the shared-schema
convention — this table is shared between both apps) that does the
check-and-increment as a single atomic `INSERT ... ON CONFLICT ... DO
UPDATE`, applied identically here and in podHq.

**Dependency vulnerabilities patched**: `npm audit fix --force` (`next`
16.2.11 → 16.3.1, plus transitive `postcss`/`sharp`/`nanoid`) — 0
vulnerabilities remaining. This pulled in a stricter
`eslint-plugin-react-hooks` that promoted the two pre-existing
`Date.now`-purity warnings noted at the end of the Stage above
(`booking-grid.tsx`, `bookings-view.tsx`) to hard errors. Fixed properly
rather than suppressed: `now` is `useState(() => Date.now())`, refreshed
every 60s via a `useInterval`-style effect, instead of called directly
during render.

**Not yet deployed** — these changes (plus podHq's parallel fixes) are
still local-only as of this entry. `npx tsc --noEmit`, `eslint`, and
`next build` all pass clean. Next step: commit, push, deploy to
production, then a real install-and-use PWA test on a phone against the
live URL (the local-dev PWA verification in the Stage above only covered
`localhost`, not a real installed-app experience).

**Same-day follow-ups, after the first deploy above**:

**Real phone install/offline test against production** surfaced two
unrelated real issues, both fixed live rather than in code: (1) Supabase
Auth's **Site URL** was still `http://localhost:3000` — a signup
confirmation link sent to a real production visitor pointed at
`localhost` and would 404 for anyone but a local dev. Fixed by updating
Site URL to `https://podhq-client.vercel.app` in the Supabase dashboard
(Redirect URLs already correctly had the production `/auth/callback`
entry — only Site URL was stale). (2) Testing "forgot password" hit a
real, unrelated `user_banned` error — traced to reusing an email address
already tied to an old, deliberately-deactivated podHq **owner** test
account (Supabase Auth is one shared user pool across both apps) — not a
bug, just an identity collision from reusing a test email; resolved by
using a fresh address.

**Install-prompt banner** (`src/components/install-app-card.tsx`, shown
on `/profile`) — added after live-testing surfaced that nothing in the
app told a member this was installable at all, especially on iOS where
there's no browser-level hint either (Apple has no `beforeinstallprompt`
equivalent). Android/Chrome gets a real "Install" button wired to the
native `beforeinstallprompt` flow; iOS gets static "Tap Share → Add to
Home Screen" instructions. Dismissible (localStorage), hidden entirely
if already running standalone. `dismissed`/`ios` use lazy `useState`
initializers rather than an effect + synchronous setState, same fix
pattern as podHq's `turnstile-widget.tsx` — same stricter
eslint-plugin-react-hooks from the dependency upgrade above.

**One-time-per-member catalog items** (podHq's Stage 22 has the full
design rationale — this is the client-side half): `getCreditPackages`/
`getCreditPackageById` now surface `oneTimePerMember`; a new
`hasMemberClaimedItem`/`getClaimedOneTimeItemIds` pair
(`src/lib/data/catalog.ts`) answers "has this member already received
this item" from `credits.catalog_item_id` (new column, previously
nothing tracked this). `/api/checkout` blocks a repeat self-service
purchase server-side (409) — the real enforcement point, not just a UI
nicety — and `/buy-credits` shows a "One-time offer" badge plus an
already-claimed disabled state instead of letting a member hit a
surprise rejection at checkout. The Stripe webhook now tags
`catalog_item_id` on every credit-pack purchase (both the self-service
`checkout.session.completed` path and podHq's staff-initiated
`payment_intent.succeeded` path — one webhook, one shared fix, covers
both apps). Staff selling/comping via podHq is deliberately exempt from
the block, per the user's explicit requirement.

`npx tsc --noEmit`, `eslint`, and `next build` all pass clean.

## Signup gym dropdown, ending single-gym-pilot scope — 2026-08-16

Added a "Your gym" dropdown to `/signup`, replacing the hardcoded
`PILOT_GYM` ("Aylesbury Berryfields") every new member was silently
assigned to regardless of which gym they actually attend. Confirmed with
the user first whether to list all 9 gyms now or keep it Aylesbury-only
until other locations are ready — user chose **all 9**, so this is a real
scope change, not just a UI addition: it deliberately ends the
"Aylesbury Berryfields only, not multi-gym yet" pilot-scope decision
documented earlier in this file. A gym without pod/Kisi config yet
(`gym_kisi_mapping`) isn't blocked from signing up members — they just
fall back to that table's existing defaults (capacity 1, open all day)
until staff configure it properly from podHq's `/pods`.

`src/lib/gym.ts`'s single `PILOT_GYM` string became a `GYM_NAMES` array +
`GymName` type, matching podHq's own gym list verbatim (same list that
must stay in sync across both repos, per the "exact gym name strings"
convention podHq's ROADMAP documents). `signupSchema` now validates `gym`
against it. The account-linking flow (`/api/auth/link-existing-account`,
triggered when someone signs up with an email that already exists
elsewhere in the shared Supabase project, e.g. a podHq staff login) also
used `PILOT_GYM` and needed the same fix — the selected gym now travels
through the magic-link redirect URL (`emailRedirectTo`) alongside the
already-established `name` param, read back out in `/auth/callback` and
posted through to the linking route. A stale/missing `gym` on that path
(a magic link sent before this change existed) is rejected outright
(400, "this link has expired") rather than silently defaulting to
Aylesbury — the member never actually chose that, so guessing would be
wrong, not just imprecise.

Also updated the login and reset-password page subtitles, which
hardcoded "My Fit Pod — Aylesbury Berryfields" as static branding text —
left as-is they'd now misleadingly suggest the app is still
Aylesbury-only to a member from any other gym. Simplified to "My Fit
Pod".

**Not yet live-tested** — needs an actual signup run through the real UI
for at least one non-Aylesbury gym to confirm the dropdown, validation,
and the account-linking redirect path all work end-to-end; the
account-linking branch specifically has no automated test coverage and
was previously only exercised with the hardcoded constant. `npx tsc
--noEmit`, `eslint`, and `next build` all pass clean.

## Per-gym Resend accounts, same day — 2026-08-16

The user wants each gym on its own Resend account with its own send
quota, not the one shared `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` this app
has always used. Real reason: Resend's free tier is a hard 100-email/day
cap with no graceful queueing (unlike Brevo, which auto-resumes a paused
campaign the next day) — a booking-confirmation email sent after the cap
is hit just fails outright, so one shared account across a growing
franchise risks silently dropping real member-facing email as more gyms
come online. Full design discussion (including why Resend didn't need a
separate *account* per gym the way Brevo does, but the user specifically
wanted separate *quotas* anyway, which does require it) is in podHq's
ROADMAP — the config table (`gym_resend_config`,
`0037_gym_resend_config.sql`) and its admin-only Setup UI both live
there; this repo only ever reads it, never writes it.

**This app's half**: new `src/lib/data/resend-config.ts` —
`getGymResendConfig(gym)` reads `gym_resend_config` via the shared
service-role client and decrypts the stored API key. The decrypt logic
(AES-256-GCM) is a second, independent copy of podHq's
`secret-encryption.ts` — the two apps are separate repos/deploys with no
shared package, so it has to be duplicated exactly rather than imported,
and must stay byte-for-byte compatible with whatever encrypted it on the
podHq side.

`sendEmail()` (`src/lib/notifications/resend.ts`) now takes a required
`gym`, looks up that gym's config, and **falls back to the existing
shared env vars** if the gym has none configured yet — deliberately not
a silent skip, since these are member-facing transactional emails
(booking confirmations, purchase receipts), not a low-stakes marketing
sync. `notifyFireAndForget()` (`src/lib/notifications/core.ts`) now
requires `gym` too, which propagated to all 13 call sites across 6
files: `api/auth/signup`, `api/bookings`, `api/bookings/cancel`,
`api/notifications/win-back`, `lib/waitlist/offer-next`, and 7 separate
sites inside `api/webhooks/stripe` (voucher purchase + staff alert,
two credit-pack-purchase paths, membership started, staff
cancellation alert, membership renewed). Every call site already had a
gym value in scope — `member.gym`, `contact.gym` (from
`resolveMemberContact`), `purchaser.gym`, or an existing `gym` function
parameter — so this was mechanical, not a redesign. Caught every missed
site via `tsc` itself (making `gym` required turned a missed call site
into a compile error) rather than manually re-grepping the codebase.

Supabase Auth's own emails (signup confirmation, password reset) are
explicitly **unaffected** — those are sent by Supabase itself via one
project-wide custom SMTP setting with no per-gym concept at all, and
stay on the existing shared configuration.

**Not yet exercised with a real per-gym account** — every gym currently
has no `gym_resend_config` row, so every send still goes through the
shared fallback exactly as before this change; the per-gym path itself
(config present, used instead of the fallback) hasn't been triggered
live yet, since no gym has actually connected its own Resend account.
`npx tsc --noEmit`, `eslint`, and `next build` all pass clean.

## Health check endpoint + first regression tests, same day — 2026-08-16

Prompted by an honest business-analysis of the whole system (both
repos) — two of the risks it surfaced had a real code fix: no automated
tests anywhere, and no uptime monitoring.

`GET /api/health` (`src/app/api/health/route.ts`) — unauthenticated
(added to `PUBLIC_API_EXACT_PATHS` in `proxy.ts`, same exact-path
convention the 2026-08-16 OWASP audit established for the cron routes
above, deliberately not a prefix), checks real Supabase connectivity via
a cheap `head: true` query against `members`, returns 503 on failure so
an external uptime monitor can alert on it. Verified live against the
local dev server. Not yet wired to an actual monitoring service — that's
a manual signup step, not code.

**Vitest added** (`vitest.config.ts`, `npm test`) — first test framework
this repo has had. `server-only` throws unconditionally outside Next's
bundler, so the config aliases it to a no-op shim
(`src/test/server-only-shim.ts`).

**Two regression tests, both encoding a bug that actually happened**:

- `src/lib/pods/bookable-hours.test.ts` — the BST timezone bug from
  Stage 15 (a plain server-side `.getHours()` would read the wrong hour
  during British Summer Time since Vercel's functions run in UTC
  internally). The check itself was extracted out of `/api/bookings`
  into a standalone `isWithinBookableHours()` (`src/lib/pods/
  bookable-hours.ts`) so it's actually unit-testable — asserts a slot at
  09:00 Europe/London during BST is correctly read as hour 9, not the
  UTC hour 8.
- `src/lib/validation/auth.test.ts` — the multi-gym signup dropdown
  added earlier this session turned `gym` into real client-supplied
  input for the first time (previously a hardcoded constant); asserts
  `signupSchema` rejects a gym string that isn't one of the 9 real
  franchise names, not just whatever a `<select>` happens to render.

**Deliberately not attempted this pass**: booking capacity/advisory-lock
concurrency and the cross-gym ownership checks scattered across the
Stripe webhook and booking routes aren't unit-testable without either
significant mocking or a real integration test against a live Supabase
project — worth doing, but a separate pass, not folded into this one.

`npx tsc --noEmit`, `eslint`, `next build`, and `npx vitest run` all
pass clean.

## `APP_URL` production gap + push-subscription self-heal — 2026-08-17

User noticed a waitlist-offer email linked to `localhost:3000` instead of
production. Root cause: `appUrl()` (`src/lib/notifications/core.ts`) fell
back to `http://localhost:3000` whenever `process.env.APP_URL` was unset,
and `APP_URL` had never been added to Vercel — silently broken since
whichever session first wrote that fallback. Affects every notification
that links back into the app: waitlist accept (`waitlist/offer-next.ts`),
buy-credits (`api/bookings/route.ts`), win-back
(`api/notifications/win-back/route.ts`). Fixed two ways: `APP_URL` added to
Vercel (`https://podhq-client.vercel.app`, Production only — Preview
deliberately left unset, since a fixed URL can't match Preview's
per-deployment hostnames anyway), and `appUrl()` now throws outside local
dev if `APP_URL` is unset, so this fails loudly next time instead of
silently defaulting to localhost.

**Verified live** via a real production round-trip: two throwaway members
(Aylesbury Berryfields) — one booked a real slot, the other joined its
waitlist — then logged into production as the first member through the
actual UI and clicked **Cancel session** for real, triggering
`offerNextWaitlistEntry()`. Confirmed via `notification_log`: the
`waitlist_offered` email sent successfully with a real Resend message ID.
First attempt addressed the waiting member with a Yahoo `+alias`
(`carlsimpson83+podhqwaitlisttest@yahoo.co.uk`) and the user never
received it — consistent with Yahoo's known-unreliable plus-addressing
(see podHq's ROADMAP Stage 9/22 notes on the same thing). Re-ran addressed
to the user's real member account (id 12) directly instead — confirmed
sent — establishing **don't use a Yahoo `+alias` for live-test email
delivery, use the plain address**. All throwaway members/bookings/
waitlist rows/auth users deleted after each run; the real member's data
was only ever given a temporary `waitlist_entries` row, also deleted
immediately after.

**Second, unrelated bug found from the same live test**: the "Enable
notifications" banner on `/bookings` (`src/components/bookings-view.tsx`)
only shows when `Notification.permission === "default"`. The user had
already clicked it once, that morning, before `VAPID_PUBLIC_KEY`/
`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` existed in Vercel's env (same gap as
`APP_URL` — present locally, never added to production) — so the browser
recorded permission as granted, but `subscribeToPush()`'s POST to
`/api/push/subscribe` never actually saved a row, and the banner then
had no way to reappear since permission was no longer `"default"`.
Confirmed via direct query: zero rows in `push_subscriptions`, for any
member, ever, at the time this was found. VAPID keys added to Vercel
(existing values reused, not rotated, since zero subscriptions existed to
invalidate) — mistakenly added to **podHq's** env at first, moved to
**podhq-client** once caught, matching the same wrong-repo slip already
on record for the Stripe keys and `SECRET_ENCRYPTION_KEY`.

Fixed properly rather than just telling the user to reset their browser's
site permission once: new `GET /api/push/subscription-status`
(session-gated, returns whether the current member has any
`push_subscriptions` row) plus an effect in `BookingsView` that, whenever
`Notification.permission === "granted"`, checks that endpoint and silently
calls `subscribeToPush()` again if nothing is actually saved —
`requestPermission()` resolves immediately with no prompt once already
decided, so this self-heals with no visible UI change. `npx tsc --noEmit`
and `eslint` both pass clean on the changed files.

**Same-day follow-up: fully live-verified, after chasing three more real,
separate bugs before push actually worked end-to-end.** What looked like
one stuck problem was five independent things stacked on top of each
other — each fix was real and necessary, none alone was sufficient:

1. **`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` were never in
   Vercel's env at all** — same class of gap as `APP_URL` above, present
   locally, never added to production. Zero rows had ever existed in
   `push_subscriptions`, for any member, confirming this wasn't
   account-specific. Regenerated fresh via `npx web-push
   generate-vapid-keys` (offered, but the user reused their existing local
   pair instead, added to Vercel — first attempt landed in **podHq's** env
   by mistake, same wrong-repo slip as the Stripe keys and
   `SECRET_ENCRYPTION_KEY` before it, moved to podhq-client once caught).

2. **`connect-src 'self'` in the CSP (`src/proxy.ts`) silently blocked
   `pushManager.subscribe()`** — Chrome's Push API routes the actual
   subscribe call through `fcm.googleapis.com` over a real network
   connection from the page's own process, which page CSP does govern.
   Same class of gap as this project's Turnstile and Stripe-embedded-
   Checkout CSP misses — a third-party integration needing an explicit
   connect-src allowance that a plain `'self'` silently blocks with zero
   error pointing at the real cause. Added `https://fcm.googleapis.com`.

3. **A genuine hydration crash in `BookingsView`** (React error #418,
   confirmed live via `mcp__claude-in-chrome`, reproduced identically on a
   fresh unauthenticated tab): `notifPermission` read
   `Notification.permission` in a `useState` lazy initializer, which still
   runs during React's render phase on both server and client — the
   server has no `Notification` global (always `null`), but the client's
   first render (which must match the server's or hydration fails)
   computed a real permission value. This silently broke every push-
   related feature on the page regardless of any server config being
   correct. Fixed with `useSyncExternalStore` instead — its server
   snapshot is always `null`, guaranteeing the first client render
   matches, with the real value taking over immediately after hydration
   commits. `enableNotifications`'s manual `setNotifPermission` call
   became unnecessary too — any re-render (already triggered by
   `setSubscribing`) re-reads the live value on its own.

4. **A second, unrelated hydration crash, same page, same React error**:
   `formatSlot`'s `toLocaleDateString`/`toLocaleTimeString` had no
   `timeZone` option, so it rendered in whichever local timezone the
   executing environment happened to be in — Vercel's functions run in
   UTC internally regardless of region pin (already documented for the
   self-service bookable-hours check, Stage 15 — never applied to this
   display code), so server (UTC) and the user's own browser
   (Europe/London, BST) genuinely differed by an hour for the same
   booking. Confirmed via direct browser testing that this exact error
   also reproduces on `/book`, unrelated to anything push-specific — same
   bug, different page. Fixed with an explicit `timeZone: "Europe/London"`
   everywhere the pattern was found: `bookings-view.tsx`,
   `waitlist-offer-view.tsx`, `profile-view.tsx`, `booking-grid.tsx`
   (4 call sites), and `app/page.tsx` (a Server Component — not a
   hydration risk there, since it never re-runs client-side, but still
   wrong without the fix: it would show UTC wall-clock time instead of
   the gym's actual London time). **`booking-grid.tsx`'s `hourSlots()`/
   `startOfDay` (and `bookingWindowDates()`/`startOfToday()` in
   `src/lib/booking-dates.ts`) have a deeper, related issue not fixed
   this session** — `setHours(0, 0, 0, 0)` builds the actual `Date`
   objects in local system time, not just their display string, so
   server and client can construct genuinely different day-boundary
   instants, not just different-looking text for the same instant. A
   proper fix needs the whole "what day is 'today'" pipeline anchored
   explicitly to Europe/London (e.g. via `Intl.DateTimeFormat` component
   extraction) rather than any local `Date` methods — flagged for a
   dedicated session, not attempted reactively here given the scope and
   risk of touching the core booking-window calculation live.

5. **podHq's own magic-link login redirected to podhq-client's sign-in
   instead** — surfaced by the user separately while working through an
   unrelated real lockout on their own account (see below), but same
   session, same root-cause family: podHq's `emailRedirectTo` was always
   correct in code (`${origin}/auth/callback`), but Supabase only honors
   that if the exact URL is in the project's Redirect URLs allowlist,
   otherwise it silently substitutes the global Site URL — which had been
   set to `https://podhq-client.vercel.app` (this project's own Stage
   1280ish fix, from getting *that* app's confirmation emails working).
   Only podhq-client's callback URL had ever been added to the shared
   project's allowlist; podHq's own `https://podhq.vercel.app/auth/callback`
   never was. Fixed by adding it (Supabase dashboard, both URLs coexist
   fine in the same allowlist — Site URL is only a fallback for whichever
   redirect isn't recognized, not a router).

   **Real, live account lockout hit and resolved along the way, worth
   recording since it's a structural gap, not a one-off**: the user's
   shared admin/member account (MFA-enrolled, via podHq) got stuck
   because **podhq-client has no MFA support at all** (deliberate pilot-
   scope simplification) and Supabase requires an AAL2 (MFA-verified)
   session to change a password on any MFA-enrolled account — so
   podhq-client's own `/reset-password` screen can never complete a
   password change for this specific account, no matter what's entered;
   it was showing a generic "Could not set password" with no way to
   diagnose it. Fixed the error visibility
   (`/api/auth/set-password/route.ts` now returns Supabase's real
   `error.message` instead of a hardcoded string — this is what actually
   surfaced `AAL2 session is required to update email or password when
   MFA is enabled`) and resolved the immediate lockout by changing the
   password through podHq instead (which does have full MFA support,
   reaching AAL2 normally). Separately, the user got rate-limited
   (`checkAuthActionRateLimit`, 3 magic-link requests per 15 min) while
   testing the redirect fix — worked around live via
   `admin.auth.admin.generateLink()`, a privileged call bypassing the
   app's own rate-limited endpoint, same escape hatch already documented
   in this file's Stage-6/collision-testing section above. No code
   changed for either of these — both are expected behavior given the
   deliberate MFA/no-MFA split between the two apps, not bugs, but worth
   remembering next time this exact account gets stuck the same way.

**Verified live, end to end, for real** (not simulated): after all five
fixes above, a fresh browser-tab permission grant (the user tapping
"Allow" on Android Chrome, not the previously-installed home-screen PWA
which turned out to hold a stale, separately-cached instance — uninstalling
it and testing in a plain tab was what finally isolated the real signal)
produced an actual `push_subscriptions` row within seconds
(`endpoint` on `fcm.googleapis.com`, confirming the CSP fix specifically).
A real test push sent via a throwaway script (`web-push`, the same library
`src/lib/push/send.ts` uses) arrived on the user's phone as an actual
notification. `npx tsc --noEmit`, `eslint`, and `next build` all pass
clean across every file touched.

**Same-day follow-up: notification icon added, and a real "possible
spam" flag explained (not a bug).** `sw.js`'s push handler had no
`icon`/`badge` at all — added both (`/icons/icon-192.png`), since a bare
notification with zero branding is a real, if minor, quality gap
independent of the spam finding below. Separately: after several
generic, near-identical test pushes in quick succession ("Testing...",
"Still working ✓", etc.) from this brand-new domain with no prior
notification history, Android/Chrome's own Safe Browsing notification-
content heuristic flagged them as **"Possible spam"** in the tray — a
real Chrome anti-abuse feature reacting to *volume and genericness of
test traffic*, not a defect in delivery or the app (the subscription and
delivery mechanism were unaffected throughout; confirmed via
`push_subscriptions` and successful `sendNotification()` calls). Real
production notifications (a specific waitlist offer, tied to an actual
action, spaced naturally) are exactly the pattern this classifier is
designed *not* to flag. **Lesson for future sessions: don't send
several generic throwaway test pushes back to back** — it pollutes the
domain's own notification reputation on the tester's device for no
diagnostic gain beyond the first one.

## Multiple bookable resources per gym (Hove) shipped; production deploy
gap found and fixed; the timezone hydration bug from earlier this file
finally fixed for real — 2026-08-17, same day, later session

Picks up directly from podHq's own ROADMAP Stage "Multiple bookable
resources per gym" — full architecture/schema/RPC detail lives there
(`pod_resources`, `resource_id` threaded through bookings/waitlist,
`credit_type` threaded through credits/catalog/gift_vouchers), built and
merged to `main` in both repos as an emergency deploy after discovering
the already-applied DB migration had left production code (still on the
pre-migration table name) actively broken for real Aylesbury usage. This
entry covers what happened *after* that merge, specific to this repo.

**podhq-client's production deploy silently never happened.** `git push
origin main` succeeded (confirmed both locally and against
`origin/main`), and podHq's Vercel project picked up the new commits and
redeployed within a minute — but podhq-client's didn't, and kept serving
a build from ~5 hours earlier despite `vercel ls` showing a `-git-main-`
alias (proving GitHub integration exists in general). Root cause
(confirmed with the user checking Vercel's dashboard directly): **this
project has never used GitHub-push-triggered deploys at all** — every
previous production deploy, including the "49m ago" one that made podHq
look fine, was a manual `vercel --prod` CLI run, not a webhook. There was
no broken integration to fix; the fix was just running `vercel --prod`
for real, which the user explicitly asked for after the dashboard showed
no queued/failed deployment and no GitHub App installation to check
either. **Lesson: don't assume `git push` deploys a Vercel project on
this stack — verify the actual deploy mechanism (`vercel ls` timestamps,
dashboard, or just ask) before treating a push as equivalent to shipping,
especially for an "emergency" fix.**

**Once genuinely running the new code, a real production-only crash
surfaced**: `/book` threw an unhandled server exception (Next's generic
"This page couldn't load" fallback, React error #441) on every load.
Root-caused properly rather than guessed at — reproduced first in local
`next dev`, then in a local `next build && next start` (both clean, no
crash), which by itself proved the DB/schema side was healthy and pointed
straight back at the just-fixed deploy gap: production was still on old
code trying to query `gym_kisi_mapping` by its pre-migration name.
Confirmed via a throwaway service-role script against the real prod DB
(`pod_resources`, `bookings.resource_id`, `waitlist_entries.resource_id`,
`get_credit_balance()` all present and correct) before touching any code
— the data was never the problem.

**Redeploying then exposed the actual bug flagged but not fixed earlier
in this file (see finding 4 above, `bookingWindowDates`/`hourSlots`)** —
`booking-grid.tsx` built and read slot times via local `Date` methods
(`setHours`/`getHours`/`getDate`), which resolve in whatever timezone the
executing machine is in. Vercel's server runs in UTC; a UK member's
browser runs in Europe/London (BST for half the year) — a "use client"
component still renders once server-side for the initial HTML and once
again client-side for hydration, and if those two environments disagree
on what "today" or "17:00" actually is, the rendered output disagrees
too. This is exactly why it never reproduced locally, in either dev or
production-build testing: the same machine was always both "server" and
"client" in every local test, so there was no timezone gap to expose it.
Only a real Vercel-hosted server paired with a real browser surfaces it.

Fixed properly, not reactively patched: new `src/lib/london-time.ts`
(`londonWallTimeToUtc`, `londonMidnight`, `addLondonDays`, `londonHour`,
`londonHourOf` — all Intl.DateTimeFormat-based, same established pattern
as `src/lib/pods/bookable-hours.ts`'s existing fix for the self-service
hours check, generalized here rather than duplicated again) with
`src/lib/london-time.test.ts` covering the actual risk: correct UTC
offset in both GMT and BST, and — the case a naive fix would get wrong —
a day added across the real 2026 BST→GMT clock-change date doesn't drift.
`booking-dates.ts` (`formatDateParam`/`bookingWindowDates`/
`parseDateParam`) and `booking-grid.tsx` (`hourSlots`, the
`openHour`/`closeHour` slot filter, the day-strip's displayed date
number) now route every date construction/read through these helpers
instead of local accessors.

**A second instance of the same bug class found and fixed in the same
pass**: `src/lib/use-install-prompt.ts` still used the old, already-
disproven pattern this file's own finding 3 (above) already fixed
elsewhere — `useState(isStandalone)`/`useState(isIOS)` lazy initializers
reading `window.matchMedia`/`navigator.userAgent` directly. A lazy
initializer still runs during React's render phase on both server and
client, so this had the exact same hydration-mismatch shape as
`notifPermission` did. `BottomNav` (rendered on `/book`, via
`booking-grid.tsx`) is what surfaced it: after the timezone fix above
resolved the fatal #441, a second, non-fatal but still real #418 kept
appearing from this exact call site. Fixed with `useSyncExternalStore`,
same proven pattern, server snapshot always `false`.

**Verified live, for real, after each fix, not assumed**: production
`/book` reproduced the #441 crash consistently (3 separate loads) before
the deploy fix; a fresh local `next build && next start` login as a real
throwaway-password test member (`waitlist-test-member@example.com`,
password reset via `admin.auth.admin.updateUserById` for this one test)
rendered clean, confirming the deploy gap as the cause rather than a code
bug; after `vercel --prod`, production still crashed but now with #418 in
a different, already-familiar shape, confirming progress not regression;
after the `london-time.ts` fix + redeploy, `/book` rendered real Aylesbury
data (actual credit balance, actual bookings, actual open slots) with a
lingering non-fatal #418 still logged; after the `use-install-prompt.ts`
fix + third redeploy, a completely fresh navigation produced zero console
errors. `npx tsc --noEmit`, `eslint`, and `npx vitest run` (21 tests,
including the 6 new timezone ones) all pass clean. Local
throwaway-password test member's password is a one-off random value, not
reset back — same account already existed as an established test
fixture from earlier sessions, no cleanup needed beyond that.

**Not yet done**: the two production hotfixes in this section
(`london-time.ts`/`booking-dates.ts`/`booking-grid.tsx` and
`use-install-prompt.ts`) were deployed straight via `vercel --prod`
before being committed — this entry's own commit is what finally brings
git history back in sync with what's actually running in production.
Tomorrow's session: confirm the Hove/Brighton resource-selector UI (the
two-button Gym/Wellness Room switch already built in `booking-grid.tsx`,
see podHq's ROADMAP Stage 15) actually matches what's wanted before
assuming it needs new work — it may already be done.
