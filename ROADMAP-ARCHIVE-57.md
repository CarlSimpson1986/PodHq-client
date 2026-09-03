# Archive 57 — Trial start into onboarding, distinct icons (2026-09-02)

Split out 2026-09-03 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, fully resolved
and verified. Reference-only, not `@`-included anywhere.

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

**Follow-up, same day, live-verified on production**: re-ran the whole
trial-start → onboarding → Pod Coach welcome flow against the real
`podhq-client.vercel.app` deploy (not just local dev) — confirmed
identical to local: straight into `/coach-onboarding`, correct
`trial_pending`-aware Pod Coach welcome on Dashboard, both bubble icons
rendering distinctly. Carl, on the actual onboarding page: `/coach-
onboarding`'s header still read "Set up your AI Coach" — inconsistent
with the trial now being framed as "Free upgrade to Premium," not just
an AI Coach trial. Changed to "Set up your Premium profile"
(`coach-onboarding/page.tsx`'s `PageHero` title only — the handful of
"Set up your AI Coach first" *error* messages elsewhere, e.g.
`coach-chat/route.ts`, are a different surface and weren't touched).
