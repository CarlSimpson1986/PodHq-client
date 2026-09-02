# Archive 54 — Pod Assist / Pod Coach first-time welcomes (2026-09-02)

Split out 2026-09-02 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere. Superseded in part by the
same day's later "Trial start goes straight into onboarding..." entry,
still active in `ROADMAP.md`, which moved where Pod Coach's welcome
triggers from.

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

**Same fixes extended to Pod Coach's trial welcome, same day** — Carl:
"pod assist and pod coach" (the first pass above only touched Pod
Assist). `coach-chat-view.tsx` gained an `onDismiss` prop and an
`isWelcomeOnly` check (a lone seeded assistant message, no user turn
yet — the same signal `dashboard/page.tsx`'s `seedCoachWelcomeMessage`
produces) to show "Maybe later" without disturbing the existing
`messages.length === 0` gate on the unrelated "Quick questions" list
(already correctly hidden once a welcome is seeded — that one was never
broken). `pod-coach-bubble.tsx` got the identical `origin-top-right`
scale/opacity entrance transition as `pod-assist-bubble.tsx`. Re-verified
live: a fresh `trial_active` test member with `coach_profiles` and
privacy already accepted saw Pod Coach auto-open with the greeting and
"Maybe later" together, and dismissing it closed cleanly.
