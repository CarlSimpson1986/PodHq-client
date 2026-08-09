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

   **Still needed:** wait for Brevo's daily quota to reset (or upgrade the plan) and re-run the same walkthrough — signup → confirmation email actually arriving → clicking it → landing on `/book` — plus the forgot-password → reset → sign-in-with-new-password walkthrough and the hard-lockout-clears-on-reset behavior specifically.

6. **Deploy to Vercel** — separate deployment from podHq; not yet configured.

7. **Location-gated unlock** — added to the roadmap 2026-08-09, sequenced after Stripe (Stage 4) at the user's request. Real goal, confirmed with the user: stop a member from unlocking the door remotely for someone who isn't actually with them, not just a soft "you look far away" nudge. **Not yet designed.** Flagged before design starts: the naive approach — reading the browser's Geolocation API and checking distance to the gym — is self-reported by the client and trivially spoofable (devtools location override, GPS-spoofing apps), so on its own it would add a permission prompt without actually closing the hole a motivated member could walk through. Needs a real design discussion before implementation: options worth weighing include Kisi's own proximity/BLE-based unlock (if it exists as an alternative to the REST API this app currently calls) versus accepting some other harder-to-spoof signal, or explicitly documenting this as a deterrent-only control if no tamper-proof option exists at this budget/complexity level. Don't start building against a plain `navigator.geolocation` check without that discussion happening first.

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
