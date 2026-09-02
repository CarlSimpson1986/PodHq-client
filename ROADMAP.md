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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-54.md`, covering the pilot
mechanism proof (2026-08-05) through the first pass of Pod Assist/Pod
Coach first-time welcomes (2026-09-02) — all split out to keep this file
within Claude Code's ~15,000-character `@`-import limit. Archives aren't
always the strictly oldest material — the split point is "what's
finished and stable" as much as "what's oldest" (see each archive's own
header note for examples). Reference-only, not auto-loaded by CLAUDE.md;
check them for full build history, or `git log` on this file for exact
split points. Active content here starts at "Trial preview copy
strengthened" (2026-09-02). If this file grows too large again, split
it the same way: move the most clearly finished section into
`ROADMAP-ARCHIVE-55.md`, update this paragraph.

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
clear fixed it (hit again, same fix, on the follow-up copy pass below).

**Second pass, same day**: Carl, after actually reading the modal live —
"it's not just your free AI Coach trial, it's a free upgrade to
Premium." Reframed the header ("Free upgrade to Premium") and subtitle
around that positioning, and swapped the 4 bullets from feature-level
copy to outcome-level selling points: personalised coaching journey,
accountability, results, wearable sync. Same `tsc`/`eslint`/local-dev
verification as the first pass.

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

## Trial start goes straight into onboarding; Pod Coach welcomes at trial_pending too; distinct bubble icons — 2026-09-02

Carl, after actually clicking through the trial flow live: "there is no
premium onboarding, just 'you are in'? as soon as i hit start your free
trial it should be into the onboarding questions...then Pod coach takes
you around." Also: "the icons dont say pod assist or podcoach? they
should be visually different" — both `pod-assist-mark.png` and
`pod-coach-mark.png` turned out to be the exact same generic white
chat-bubble glyph, genuinely indistinguishable at a glance.

**Trial start**: `trial-banner.tsx`'s "You're in" confirmation screen
removed — `startTrial()` now `router.push`es straight to
`/coach-onboarding` on success (that page already redirects home if a
profile somehow exists, so no extra guard needed). `coach-onboarding-
form.tsx`'s existing `router.push("/")` on completion was untouched.

**The "Pod Coach takes you around" half** needed a real gap closed, not
just the redirect: onboarding finishes in `trial_pending` (the 7-day
clock only starts on the first booking — see `start-trial/route.ts`'s
own comment), but Pod Coach's welcome-seeding in `dashboard/page.tsx`
was gated to `trial_active` only, so it silently never fired at the
moment it mattered. Moved the `getCoachConversation`/
`seedCoachWelcomeMessage` logic out from inside the `showFullDashboard`
block into its own step that runs whenever `coachProfile` exists —
conversation still loads normally for subscribers (unaffected), but the
welcome itself now seeds for `trial_pending` or `trial_active` with an
empty conversation, with state-aware wording ("Book your first session
to kick off your 7-day trial" vs "You're on your 7-day free trial").

**Icons**: `pod-assist-bubble.tsx` → black circle, `ChatBubbleIcon`,
"Assist" label chip. `pod-coach-bubble.tsx` → gold (`bg-accent`) circle,
`DumbbellIcon`, "Coach" label chip — reusing icons already in
`icons.tsx` rather than commissioning new art, and matching `DumbbellIcon`
being the AI Coach's existing icon elsewhere in the app (trial banner,
`AICoachSection`). The old identical PNG marks are now unused (left in
`public/`, not deleted — no other references checked for this session).

Same "Maybe later" dismiss + `origin-top-right` entrance animation
fixes from earlier today (see above) apply to both bubbles unchanged;
this stage only touched what triggers them and what they look like.

**Verified**: `tsc --noEmit`/`eslint` clean on every changed file.
Live-tested in local dev end to end via a fresh synthetic member (no
trial, no coach profile): tapped the trial banner → preview modal →
"Start my free trial" → landed directly on `/coach-onboarding` (no
confirmation screen) → completed all 7 steps → redirected to Home →
navigated to Dashboard → confirmed `trial_pending`'s "AI Coach trial
ready" card rendered *and* Pod Coach auto-opened with the correct
state-aware welcome text and a working "Maybe later". Confirmed via DOM
inspection that the two launcher buttons now render genuinely distinct
markup (black circle + chat-bubble + "Assist" vs. gold circle + dumbbell
+ "Coach"), not just visually eyeballed. Hit the documented stale-
Turbopack-bundle issue again mid-test (edits made after `next dev` was
already running) — full process kill + `.next` clear + service-worker
unregister fixed it, consistent with prior notes on this exact failure
mode in local dev.
