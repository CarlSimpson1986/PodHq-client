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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-52.md`, covering the pilot
mechanism proof (2026-08-05) through PubMed citations made independently
verifiable (2026-08-30) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see each archive's own header note
for examples). Reference-only, not auto-loaded by CLAUDE.md; check them
for full build history, or `git log` on this file for exact split
points. Active content here starts at "`getBookingsForDate`/
`getActiveReservationsForDate` timezone bug fixed" (2026-08-30). If this
file grows too large again, split it the same way: move the most
clearly finished section into `ROADMAP-ARCHIVE-53.md`, update this
paragraph.

## `getBookingsForDate`/`getActiveReservationsForDate` timezone bug fixed — 2026-08-30

The real fix behind the `booking-dates.ts` bug flagged 2026-08-17 (that
one turned out already fixed same day, commit `ed116f3` — a stale note).
Auditing the codebase for the same bug class turned up a genuine live
instance in `src/lib/data/member.ts`: both functions built their day
window with `new Date(date); startOfDay.setHours(0,0,0,0); ...
endOfDay.setDate(endOfDay.getDate()+1)` — local Date accessors, which on
Vercel run in UTC. `date` itself was already a correct London-midnight
instant (from `booking-dates.ts`'s `parseDateParam`), but `setHours(0,
0,0,0)` re-derives "midnight" against the server's own UTC calendar day,
discarding the correct input. During BST (UTC+1, which is now, and lasts
until late October) this shifts the query window a full UTC calendar day
off from the intended London day — `/book`'s "existing bookings for this
day" and "active waitlist reservations for this day" queries could show
the wrong day's data.

Fixed by replacing both with `londonMidnight(date)` /
`addLondonDays(startOfDay, 1)` — the exact same helper pair this same
file already uses correctly in `getTodayBookingForMember` a few dozen
lines up, so this wasn't a new pattern, just two functions that never
got updated when the rest of the file adopted it.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (178/178, no
regressions — these are DB-backed functions with no existing unit test,
and the fix's correctness now flows entirely from `london-time.ts`'s own
already-tested helpers), and `npm run build` all clean. Confirmed no
regression live in local dev (`/book` still rendered today's existing
bookings correctly) — but per this exact file's own header comment, this
bug class only ever reproduces on the real Vercel deployment (UTC
server vs. a UK browser), never in local dev where both run on the same
machine, so a true BST-boundary reproduction wasn't attempted; confident
in the fix because it's a direct reuse of an already-live, already-
correct pattern from the same file rather than new logic.

## Pod Assist / Pod Coach first-time welcomes — 2026-09-02

Carl: on first login, Pod Assist should welcome the member and offer to
show them around, and the same pattern should repeat for Pod Coach on the
7-day AI Coach trial. Both reuse existing infra rather than anything new
— no new DB columns, no new API routes.

**Pod Assist (Home, first login)**: `OnboardingTour` no longer auto-drives
the driver.js tour cold. Instead it auto-opens `PodAssistBubble` with a
seeded greeting ("Hi {firstName}, welcome to My Fit Pod! You're all set
up at {gym}...") and a "Show me around" CTA that starts the existing
driver.js steps — closing the greeting without taking the tour still
stamps `tour_completed_at` (via the existing `/api/member/tour-complete`,
now called from either path, guarded with a ref so it only ever fires
once per mount). `HelpChatView` gained `welcomeMessage`/`tourCtaLabel`
props (lazy `useState` initializer so the greeting is present on first
paint, not a post-mount flash) and its quick-question/tour chips now key
off "no user message sent yet" rather than "no messages at all", so they
still show underneath a seeded greeting.

**Pod Coach (Dashboard, 7-day trial)**: gated on `coachState.kind ===
"trial_active"` AND an empty `coach_conversations` row — that emptiness
already means "never chatted with Pod Coach," so no new flag column was
needed. New `seedCoachWelcomeMessage()` (`coach-conversations.ts`) writes
a single assistant-authored opener ("Hi {firstName}! I'm Pod Coach.
You're on the 7-day free trial, training for {goal}...", using
`coach-chat.ts`'s existing `GOAL_COPY`, now exported) and is idempotent
against concurrent page loads the same way `start-trial`'s own
`trial_activated_at` check is. `PodCoachBubble` gained `initialOpen` to
auto-open on that first visit; if the member hasn't accepted the Pod
Coach privacy policy yet, the existing consent-form gate still takes
priority (correct — the welcome message is there in history once they
accept, not lost). Scoped to trial members only, not subscribers, per
Carl's ask.

**Verified**: `tsc --noEmit` and `eslint` clean on all changed files.
Live-tested in local dev (`next dev`, not the deployed preview) via a
synthetic confirmed test member (Supabase admin-generated magic link,
deleted after) — first Home visit auto-opened Pod Assist with the
personalised greeting, "Show me around" handed off cleanly into the
driver.js tour (1 of 7, correct first step), a second Home visit did not
re-open it (`tour_completed_at` correctly stamped). Seeded
`trial_active` state + a `coach_profiles` row for the same test member
and confirmed Dashboard auto-opened Pod Coach with the personalised
trial welcome once the privacy policy was accepted. Not tested: the real
production signup → email confirmation → first-login path end-to-end (a
separate, unrelated confirmation-email deliverability question raised
the same session, not yet resolved) — this stage only exercised the
onboarding UI itself via a pre-confirmed test account.

**Follow-up fixes, same day (Carl, after actually using it live)**: the
welcome's own quick-question FAQ chips were still rendering underneath
the seeded greeting (`HelpChatView`'s chip condition was "no user
message yet," which a seeded assistant message doesn't clear) — buried
the one thing that screen was for under four unrelated FAQ buttons. Now
gated on `!welcomeMessage`. Also had no way out besides the small header
✕, which read as the tour being mandatory — added an explicit "Maybe
later" next to "Show me around", same "Not now" pattern as the trial
preview modal. And the panel itself just snapped into place with no
sense of coming from the Pod Assist icon — `pod-assist-bubble.tsx` now
mounts scaled-down/transparent and transitions to full size from
`origin-top-right` (matching the icon's own position) on a `rAF`-delayed
next frame, including on the very first auto-open, not just later taps.
Separately, both post-login redirects (`login/page.tsx`,
`auth/callback/page.tsx`) still pointed at `/book` — a leftover from
before Home (`/`) existed as its own page (see this file's own earlier
note: "New Home page (`/`) replaces the old plain redirect-to-`/book`")
that never got updated when Home was built, so login was skipping the
welcome entirely. Both now land on `/`. All four re-verified live in
local dev via a fresh synthetic test member.

## Trial preview copy strengthened — 2026-09-02

Carl: give members more reasons to actually start the 7-day trial. The
existing tap-through preview (`trial-banner.tsx`, already built — not a
new flow) had 3 generic bullets from before nutrition tracking and the
research-grounded Pod Coach chat existed. Rewrote all 4 to be specific
and current, and added an explicit "Full Premium access for a week — not
a stripped-down preview" line, since `getCoachHomeState` already treats
`trial_active` identically to `subscriber` everywhere else in the app —
no pricing shown (this component has no access to catalog pricing, and
"free/no card" is the stronger anchor already on screen).

**Verified**: `tsc --noEmit`/`eslint` clean, confirmed live in local dev
via a synthetic test member. Note for next time: the PWA service worker
(`public/sw.js`) served a stale cached Home page mid-test even after a
fresh `next dev` + cleared `.next` — unrelated to this change, but real;
`navigator.serviceWorker.getRegistrations()` + unregister + `caches`
clear fixed it. Worth remembering if a change ever "doesn't show up" in
local dev again.

## Signup crash from an undecryptable gym Resend key — 2026-09-02

**Real production bug, found live**: Carl signed up on `podhq-client.vercel.app`
and got "Something went wrong. Try again." — but the account was actually
created successfully (auth user, `members` row, `leads` row, `auth_events`
row all committed; Supabase's own confirmation email genuinely sent).

Root cause: `/api/auth/signup` creates the member, then tries to email
gym staff (`staffNewSignupEmail`/`notifyFireAndForget`). Hove has a
`gym_resend_config` row, so that path calls `getGymResendConfig('Hove')`,
which calls `decryptSecret()` on the stored API key —
`SECRET_ENCRYPTION_KEY` was never set in **podhq-client's own** Vercel
Production env (confirmed by Carl checking directly; it's a separate
Vercel project from podHq, so podHq having its own copy set doesn't
cover this app — same convention noted in `secret-encryption.ts`'s own
header comment). `decryptSecret` throws when the key's missing, and that
throw was uncaught — propagating out of `sendEmail` (whose own docstring
promises "never throws") through `notifyFireAndForget` and crashing the
whole request *after* the member row had already committed, so the
client got a raw 500 it couldn't parse instead of the app's normal JSON
response. Confirmed via `notification_log`: zero `staff_new_signup` rows
since 2026-08-22 (the last one before this was found), while Hove picked
up 2 new members since then with no notification row for either — this
had been silently breaking every Hove signup's staff notification, and
showing this false error to the member, for over a week.

**Fixed**: `getGymResendConfig` (`resend-config.ts`) now catches the
`decryptSecret` throw the same way it already handled a Supabase query
error — logs it, returns `null`, falls back to the shared Resend
account. A gym's broken/missing encryption key can never crash a
signup (or any other caller of `sendEmail`) again, regardless of the
Vercel env cause. `wearables.ts`'s own `decryptSecret` call sites were
checked too — both already either throw-and-let-the-caller-handle-it
(single-connection lookup, an intentional existing contract) or already
catch-and-skip (the sync cron's batch loop), so left alone.

**Resolved 2026-09-02, Carl (manual, in Vercel — matches how
account-level Vercel/Supabase/Stripe settings get handled on this
project)**: turned out podHq's existing `SECRET_ENCRYPTION_KEY` couldn't
be copied across — Vercel's Sensitive variable type can't be read back
once saved, which is almost certainly what actually caused the original
2026-08-22 Aylesbury incident (a value that could never be verified,
not just a paste slip). Generated a fresh key instead and rotated it
properly: set in both podHq's and podhq-client's Vercel (Production +
Preview), both redeployed, then Hove's Resend API key re-saved through
podHq's `/setup` so its stored ciphertext actually matches the new key.
Full writeup of the parity requirement (and why a value alone can't be
trusted) now lives in CLAUDE.md's own "Deployment" section, not just
here, so it survives this file's own archiving.

**Verified**: `tsc --noEmit`/`eslint` clean. Root cause and impact
confirmed by direct DB inspection (`members`/`leads`/`auth_events`/
`notification_log` for the actual live signup that surfaced this).
Live re-test of the actual fix (a fresh Hove signup, checked against
`notification_log` landing as `sent`) still outstanding as of this
write-up.
