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

**Stages 1-9 (pilot mechanism proof through gift vouchers, 2026-08-05 →
2026-08-15) have been moved to `ROADMAP-ARCHIVE.md`** to keep this file
within context limits — that file is reference-only (not auto-loaded by
CLAUDE.md); check it for full stage-by-stage build history, the original
Kisi unlock verification, Stripe/membership/gift-voucher build detail,
etc. This file picks up from the 2026-08-16 OWASP audit pass and is the
active, auto-loaded log going forward. If this file grows too large again,
split it the same way into a numbered `ROADMAP-ARCHIVE-2.md` and update
this note plus `CLAUDE.md`'s session-handoff guidance to match.

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

## Hove onboarding session + shared-fallback "From" display name fix — 2026-08-18

Started from the "tomorrow's session" note above (confirm the Hove/
Brighton resource-selector UI before assuming it needs work) — reviewed
the current `booking-grid.tsx` implementation (two-button toggle, hidden
entirely for a single-resource gym) and described it, but the session
redirected into email/DNS onboarding work before it was ever pulled up
live or explicitly confirmed against what's actually wanted. **Still an
open item, not closed** — needs a real live walkthrough next session,
same as originally flagged.

Most of this session's real work landed on **podHq's** side — see its own
ROADMAP for the full account: `/setup`'s three independent gym pickers
(Catalog/Brevo/Resend) merged into one shared selector, and a genuine
production bug found and fixed while using it for real — `SECRET_ENCRYPTION_KEY`
had never been added to **either** app's Vercel Production environment,
silently breaking every per-gym Brevo/Resend config save since the
feature shipped. Fixed by rotating a fresh key and adding it to both
apps' Production env + both local `.env.local` files (the key ended up
rotated three times total before landing cleanly — the VS Code Claude
Code extension surfaces whatever text is selected/cursor-adjacent in an
open editor tab as conversation context automatically, and `.env.local`
being open leaked the value into chat by accident twice, unrelated to
the underlying bug itself). Hove's own Brevo (list ID 2) and Resend
(`hello@hove.myfitpod.co.uk`) accounts are now genuinely saved and
encrypted in production, confirmed via real `POST` requests returning 200
in `vercel logs`, not just the UI's own success state. Hove's DNS
(SPF/DKIM for `hove.myfitpod.co.uk`) is still outstanding — checked live
via a direct public-resolver lookup (Google's 8.8.8.8, bypassing the
local router) and confirmed neither record exists yet, so real sends
through Hove's own Resend account won't work until that's added at the
DNS host (Squarespace, backed by NS1 nameservers).

**Real bug found in this repo while discussing the above**: the user
noticed the shared fallback account's sender (what Aylesbury and every
other gym without its own Resend config currently uses) shows up in
recipients' inboxes as a bare address rather than a friendly name.
Root cause in `src/lib/notifications/resend.ts`'s `sendEmail()`: a gym
*with* its own `gym_resend_config` row gets its "from" header correctly
formatted as `"{fromName} <{fromAddress}>"`, but the shared-fallback path
used the raw `RESEND_FROM_ADDRESS` env var directly with no display name
at all — a real, pre-existing gap this session just happened to surface,
not something caused by today's changes. Fixed by wrapping the fallback
the same way with a hardcoded `"My Fit Pod <...>"`, matching the per-gym
format rather than adding a new env var for something that's app-wide
branding anyway. `npx tsc --noEmit` and `eslint` pass clean.

**Two more small real bugs found and fixed the same session, both from
the user just looking at the live Home page:**

- Home's "Upcoming session" card (`src/app/page.tsx`) had a "View
  booking" button that linked to `/book?date=...` — the day-grid page for
  *creating* a new booking, not a view of the existing one at all. It
  never showed the booking's own details or its Unlock/Cancel controls.
  Stale relative to the 2026-08-11 decision to move Unlock onto
  `/bookings` specifically so it sits next to the actual booking — this
  card just never got updated to match. Fixed: now links to `/bookings`.
  Relabelled "View booking" → **"Access"** (the user's call, after also
  noting the card already shows the date/time itself, so a button that
  just re-displayed that would be redundant — the real value of the link
  is reaching the actions on `/bookings`, not re-showing info already on
  screen). `formatDateParam` import removed as unused once the date-param
  link was dropped.
- `bookings-view.tsx`'s Unlock area rendered nothing at all — no button,
  no explanation — whenever a booking was upcoming but outside its
  5-minute-before unlock window, silently leaving the member with no clue
  why there was nothing to tap. Added a plain-text explanation ("Unlock
  opens 5 minutes before your session.") for that case. The *other* half
  of the original ask — a proactive "you're too far away" warning ahead
  of tapping Unlock — was considered and deliberately not built:
  geolocation prompts need a direct user gesture to fire reliably, and a
  member is normally still travelling to the gym when the window opens,
  so an early distance warning would just be noise, not something
  actionable. The existing reactive check (on tapping Unlock, server
  rejects with a clear message if too far away) stays as the real
  mechanism — matches standard practice, not a gap.

`npx tsc --noEmit` and `eslint` pass clean on both changed files.

**Follow-up, same session: the "Access" link above was still just
navigation, not an unlock.** User clarified the actual want after seeing
it live: tapping "Access" on Home's Upcoming session card should unlock
the door directly, not send the member to `/bookings` to tap Unlock a
second time. New `src/components/upcoming-session-card.tsx` (client
component, extracted out of `page.tsx` which stays a Server Component)
duplicates `bookings-view.tsx`'s unlock logic (same `WINDOW_BEFORE_MS`/
`WINDOW_AFTER_MS` constants, same geolocation-then-`/api/unlock` call) —
deliberate small duplication rather than a shared hook, matching this
codebase's existing per-component style (each of `booking-grid.tsx`/
`bookings-view.tsx`/`profile-view.tsx` already owns its own local
fetch/state logic, no shared "useBookingAction"-style hook exists to
extend). Three states: access-incomplete → "Complete Access" link (same
as `bookings-view.tsx`); in-window → live "Access" button that requests
geolocation and calls `/api/unlock` for real; outside the window → falls
back to the `/bookings` link from the fix above, plus the same "Unlock
opens 5 minutes before your session" text.

**Real bug found and fixed in the same pass**: `getNextUpcomingBooking`
(`src/lib/data/member.ts`) filtered on `slot_start >= now`, so a booking
dropped off Home's "Upcoming session" card the instant its start time
passed — exactly when a member is most likely arriving to actually
unlock it. Extended the cutoff to `now - 65 minutes`, matching
`bookings-view.tsx`'s own unlock-window grace period, so the card (and
the new direct-unlock button) stays available for as long as the door
actually stays unlockable.

**Live-verified end-to-end**, not just type-checked — real bug caught
along the way doing this properly: the pilot member had no genuine
booking landing inside the unlock window at the time of testing (a
16:00 slot visible on `/book` belonged to a different member entirely,
confirmed before assuming the card was broken when it correctly showed
"No upcoming sessions"). Inserted a real throwaway booking directly
(`slot_start` ~2 minutes out — booking creation via the UI is hour-
aligned only, so this needed a direct insert, same bypass this project's
own testing has used before) for member 1 / Aylesbury's pod resource,
logged in locally as the pilot member (password reset via the same
one-off script pattern used throughout this project), and confirmed the
Home card rendered the live "Access" button. Clicked it with geolocation
overridden to the gym's real coordinates (same spoofing technique this
app's location gate has always been documented as unable to prevent,
used here deliberately to test rather than defeat it) — got "Unlocked —
door should open now.", and cross-checked directly against
`pod_access_events` (not just the UI message): `success: true,
kisi_response: "200 OK", distance_meters: 0` — a genuine successful Kisi
call, not a client-side illusion. Throwaway booking and its access-event
row deleted afterward. `npx tsc --noEmit` and `eslint` pass clean on all
three changed/new files.

## Signup gym pre-fill via `?gym=` link — same day, 2026-08-18

Raised while the user was separately setting up Hove's Stripe/Brevo/
Resend accounts, thinking through how someone actually gets from "saw
Hove's marketing" to "signed up correctly tagged to Hove." The
2026-08-16 signup dropdown (see that entry) added the ability to pick
any of the 10 gyms, but nothing pre-selects or hints which one — a new
member has to already know their own gym's exact name among a flat
10-item list, with zero help from the app. Real risk: mis-selecting the
wrong gym at signup with a shared multi-gym app (unlike GymFlow, which
is deployed as a separate branded app per gym and doesn't have this
ambiguity at all — different architecture, not a feature gap on
GymFlow's part).

Fixed with a `?gym=` query param: `/signup?gym=Hove` pre-selects the
dropdown to Hove, still fully editable (not locked) so a wrong link
doesn't trap anyone. Deliberately not tied to any one distribution
channel — works equally as a QR code on physical signage for someone
who's already walked past the gym, or as a plain hyperlink in the
Google Form waitlist's confirmation message, an ad campaign's landing
page, or a newsletter — anywhere a gym-specific signup link can be
dropped in, for people who've never been near the physical location at
all.

`src/app/signup/page.tsx` split into an inner `SignupForm` (the actual
form, now reading `useSearchParams()`) and the default-exported
`SignupPage` wrapping it in `<Suspense>` — Next's own requirement for
any component calling `useSearchParams`, not optional. `initialGym` is
computed once from the param (validated against `GYM_NAMES` via a new
`isGymName` guard, same pattern the API routes already use) and only
ever sets the field's *initial* state — no locking, no re-syncing on
param change.

**Live-verified** (local dev, via claude-in-chrome, after logging out
of a leftover pilot-member session that was silently redirecting
`/signup` away per `proxy.ts`'s already-known behavior — same gotcha
hit earlier this session, not new): `/signup?gym=Hove` correctly showed
"Hove" pre-selected in the dropdown on load, zero hydration errors in
the console (the Suspense boundary did its job). `npx tsc --noEmit` and
`eslint` pass clean.

`GYM_SIGNUP_LINKS.md` (project root) lists the actual `?gym=` link for
all 10 gyms, ready to hand out — keep it in sync with `GYM_NAMES` if a
gym is ever renamed.

## Resource-selector buttons made more prominent — same day, 2026-08-18

The Gym/Wellness Room toggle in `booking-grid.tsx` (which resource is
about to be booked) was styled as a small text-link-style button —
easy to miss, and this is a choice that changes which pod/room a
credit gets spent on, not a minor filter. Changed to large, equal-width
(`flex-1`) pill buttons (`rounded-full`, bigger padding, 2px border)
spanning the full row under the day-strip, same position as before,
just impossible to miss now. Only affects gyms with more than one
resource (currently Hove) — a single-resource gym still shows nothing
here, unchanged. `npx tsc --noEmit` and `eslint` pass clean.

## Real fix: 30-minute Wellness/Recovery Room slots — same day, 2026-08-18

While actually looking at the new resource-toggle buttons live, the user
flagged that the Wellness Room needs 30-minute booking slots, not 60 —
and renamed it to **Recovery Room** in the same breath. Checked the DB:
`pod_resources.slot_duration_minutes` was already correctly seeded as 30
for this resource back on 2026-08-17 — the gap was entirely in the app
never actually reading it. Label rename applied directly as a DB update
(`pod_resources.label`), no deploy needed since it's read live.

**The real bug, found by actually checking**: `booking-grid.tsx`'s
`hourSlots()` always generated exactly 24 hourly slots regardless of the
selected resource, so Recovery Room only ever offered half its real
bookable capacity (a 30-min resource has twice the start times a 60-min
one does) and every displayed "18:00" would have booked a slot whose real
duration didn't match what was shown. Worse: three *other* places each
independently hardcoded the same "sessions are 60 minutes, unlock stays
open 65" assumption — `booking-grid.tsx`'s own past-slot and unlock-hint
checks, `bookings-view.tsx`'s upcoming/past split and Unlock button
window, and **`/api/unlock`'s actual server-side enforcement** — meaning
the physical door would have stayed unlockable for 35 minutes longer
than a real 30-minute Recovery Room session actually runs. Today's own
`upcoming-session-card.tsx` (built earlier this same session) carried an
identical copy of the same hardcoded assumption.

**Fixed properly, not patched four times**: new `src/lib/unlock-window.ts`
(`UNLOCK_WINDOW_BEFORE_MS`, `unlockWindowAfterMs()`, `isWithinUnlockWindow()`)
derives the window from a resource's own `slotDurationMinutes` instead of
a copy-pasted constant — same "consolidate a duplicated correctness-
critical calculation" reasoning podHq's own `resolveGym()` already
documented for exactly this failure mode. All five call sites (the four
above, in both podhq-client's UI and its own physical-door API route)
now route through it. `/api/unlock` also had its `pod_resources` fetch
moved earlier in the handler, since the window check needs it and
previously ran before the resource was ever looked up.

`london-time.ts`'s `londonWallTimeToUtc`/`londonHour` gained an optional
`minute` parameter (defaulting to 0, fully backward compatible — the
existing test suite and the one other caller in `booking-dates.ts` are
unaffected) so slot generation can land on `:30` as correctly as `:00`
across the BST/GMT transition. `booking-grid.tsx`'s `hourSlots()` became
`slotsForDay(day, durationMinutes)`, generating `(24*60)/duration` slots
at the resource's own spacing instead of always 24.

`bookings-view.tsx` and its `/bookings` page needed a new `resources`
prop threaded through (via the already-existing `getPodResourcesForGym`)
since a booking's own duration wasn't otherwise available there; Home's
`upcoming-session-card.tsx` similarly gained a `slotDurationMinutes` prop
computed by `page.tsx` from the same lookup.

**Live-verified**, and a real HMR false alarm caught along the way: the
first live check after this fix still showed hourly slots for Recovery
Room, which briefly looked like the fix hadn't worked — a hard reload
(`Ctrl+Shift+R`) showed the correct 18:00/18:30/19:00 slots immediately,
confirming it was a stale dev-server bundle (same class of glitch this
project has hit before), not a real bug. Verified via a throwaway Hove
member (created directly, pre-confirmed, to skip email verification)
switching to Recovery Room and seeing genuine half-hour slots. `npx tsc
--noEmit`, `eslint`, and `npx vitest run` (15 tests, all passing) all
clean. All throwaway test accounts created this session (the Hove
view-test member, and two earlier stuck signup-test accounts from
tonight's email-confirmation troubleshooting) deleted afterward.

## Stripe Connect — Hove pilot (per-gym payment separation) — 2026-08-19

Built at the user's request: today every gym shares one Stripe account —
Stripe itself has no concept of "which gym" a payment belongs to, only
reconstructed after the fact from `member.gym`. The user wants real
per-gym separation (own balance, own payouts, franchisees able to refund
their own clients directly), via **Stripe Connect**, piloted on **Hove**
first since it isn't open yet.

Confirmed with the user before building: Hove has no existing Stripe
account, so this uses **Connect Onboarding** (create a brand-new Standard
account) rather than OAuth-linking an existing one; connecting a gym is
**admin-only** in podHq's `/setup`, same pattern as the existing Resend/
Brevo cards; **direct charges** — the Checkout Session is created against
the gym's own connected account, so money and Stripe's fee land there
directly; and **franchisees must be able to refund their own clients from
podHq** — the one hard requirement. `podHq/src/app/api/pods/refund/
route.ts` already scoped an `owner` correctly to their own gym; the only
real gap was `stripe.refunds.create()` always hitting the platform
account regardless.

`podHq/supabase/migrations/0040_gym_stripe_config.sql` (written and
**applied 2026-08-19** — per the shared-schema rule, flagged in both
repos' ROADMAP.md) — `gym_stripe_config`: `gym` (unique), `stripe_account_id`
(not a secret, unlike the Resend/Brevo keys — no encryption needed),
`onboarding_complete`. A gym with no row (every gym today) falls back to
the shared platform account exactly as before — not a breaking change for
anyone but Hove.

**podHq (owns account creation + admin UI)**: `src/lib/data/stripe-
connect-config.ts` — `startStripeConnectOnboarding` creates the Standard
account + a fresh Account Link, `completeStripeConnectReturn` re-checks
`details_submitted` against the real Stripe object rather than trusting
the redirect alone (same "don't trust the redirect, check real state"
reasoning this app's own Stripe Checkout `success_url` already
established), `getStripeAccountId` is the read used by the refund route.
New `POST/GET /api/setup/stripe-connect` (admin-only, same
`getGymScope`/rate-limit pattern as `/api/setup/resend`) and its
`/return` callback. New `StripeConnectView` card in `/setup`'s
`SetupShell`, next to Resend/Brevo.

**podHq refunds**: `/api/pods/refund/route.ts` now looks up the paying
gym's `stripe_account_id` and passes `{ stripeAccount }` into
`stripe.refunds.create()` when present — no role/scoping change needed,
the existing owner-locked-to-own-gym check already did the right thing,
this only fixes *which* Stripe account the call hits.

**This app (podhq-client)**: new `src/lib/data/stripe-config.ts` —
cross-app read of `gym_stripe_config`, same pattern as `resend-config.ts`.
`/api/checkout`, `/api/checkout-membership` (including the tier-switch
subscription cancel), and `/api/checkout-voucher` all look up the
member's gym and pass `{ stripeAccount }` into their
`checkout.sessions.create()` call when the gym has a connected account.
`/api/webhooks/stripe/route.ts` captures `event.account` (present only
for connected-account-originated events) and threads it through every
*secondary* Stripe API call the handler makes —
`paymentIntents.retrieve`, `subscriptions.retrieve`,
`invoicePayments.list`, `customers.update` — since resolving which
member/gym a payment belongs to already works via metadata regardless of
account, but those follow-up calls 404 against the wrong account without
it.

**Real bug caught by `tsc` before it shipped**: the Stripe Node SDK takes
connected-account routing as a distinct `options` argument, not folded
into `params` — `stripe.paymentIntents.retrieve(id, options)` silently
type-checks (extra properties on a typed variable aren't flagged the way
literals are) but the option is ignored at runtime. Fixed by passing
`undefined` for `params` explicitly and `options` as the third argument
throughout.

**Flagged, not built this pass**: podHq's staff "charge card on file"
sell panel stays platform-account only — a saved card lives on the
platform account's Customer object today, and charging it against a
connected account instead is a separate, larger change (Customer/payment
methods don't automatically carry over between Stripe accounts). Every
gym besides Hove stays on the shared platform account until it's
individually connected — this pass only builds the pipe, not a rollout to
every gym.

**Not yet live-tested — two of three manual steps outstanding before it
can be**: (1) migration applied ✓, (2) Connect enabled on the Stripe
platform account (Standard accounts, direct funds flow, Stripe-hosted
onboarding + Stripe Dashboard for account management) ✓; (3) **podHq's
own `STRIPE_SECRET_KEY` is a deliberately restricted key (`Charges: read,
Refunds: write` only, per its own `stripe.ts`) — creating connected
accounts needs the `Connect` write permission added to that same
restricted key**, or the onboarding calls will fail. Once deployed, a
fourth step: toggle "Listen to events on connected accounts" on the
existing webhook endpoint so it also receives events from Hove's account
(same signing secret, no new webhook secret needed). `npx tsc --noEmit`,
`eslint`, and `next build` all pass clean in both repos.

