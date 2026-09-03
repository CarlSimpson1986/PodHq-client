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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-59.md`, covering the pilot
mechanism proof (2026-08-05) through the Pod Assist tour glow/order/
Done-X fix (2026-09-03) — all split out to keep this file within Claude
Code's ~15,000-character `@`-import limit. Archives aren't always the
strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see each archive's own header note
for examples). Reference-only, not auto-loaded by CLAUDE.md; check them
for full build history, or `git log` on this file for exact split
points. Active content here starts at "Premium onboarding overhaul"
(2026-09-03). If this file grows too large again, split it the same
way: move the most clearly finished section into `ROADMAP-ARCHIVE-60.md`,
update this paragraph.

## Premium onboarding overhaul: trial-at-signup, Coach dashboard tour, real icons — 2026-09-03

Carl, walking the Premium flow live end to end, drove a full pass on
where onboarding actually lands and what happens once it does.

**Onboarding now hands off to Dashboard, not Home** — Carl: "as soon as
the premium onboarding is done it should go to the premium dashboard
where Pod Coach takes over." `coach-onboarding-form.tsx` redirects to
`/dashboard` on completion instead of `/`.

**Trial starts at onboarding completion, not first booking.** Confirmed
via `AskUserQuestion` before touching the business logic — Carl chose
"start immediately" over keeping the old booking-gated behaviour. Moved
the `trial_started_at`/`trial_expires_at` stamp out of
`api/bookings/route.ts` into `api/member/coach-profile/route.ts` (same
`trial_activated_at set, trial_started_at still null` gate, just a
different trigger). Updated every comment and piece of copy that still
described the old behaviour — `member.ts`, `start-trial/route.ts`,
`trial-state.ts`, `trial-banner.tsx`'s footer line, and the Pod Coach
welcome message's `trial_pending` branch — plus the Home/Dashboard
`trial_pending`/`trial_active` cards, which now point at
`/coach-onboarding` and read "Premium expires in N days! Upgrade to
Premium membership to keep progressing" respectively (Carl's own
wording for the latter).

**Pod Coach's own guided Dashboard tour** — the Premium-side mirror of
Pod Assist's tour, built single-page (no cross-page hand-off machinery
needed, Dashboard is one page): `coach-tour-steps.ts` (8 steps: week
strip, recovery, sessions, nutrition, recommendation, habit streak,
leaderboard, "that's it"), `coach-tour-runner.tsx`, and
`dashboard-coach-tour.tsx` wiring a "Show me around"/"Replay app tour"
chip into Pod Coach's chat (`coach-chat-view.tsx`, alongside the
existing "Maybe later", not replacing it — that removal was Carl's call
for Pod Assist specifically, not extended here without being asked).
Built the fixes tour-runner.tsx needed the hard way (see the entry
above) in from the start this time: never overrides `onDoneClick` at
all (driver.js's own default Done/advance behaviour is simply left
alone), and the final step targets a non-interactive `#tour-coach-label`
span rather than the real `#tour-coach-button`.

**Privacy Policy consent moved into onboarding.** Was a surprise gate
the first time a member opened Pod Coach's chat — no personality before
the legal ask, Carl: "who is this." Now a required checkbox on
onboarding's final step (`coach-onboarding-form.tsx`), stamping
`privacy_policy_accepted_at` in the same request as the profile
(`coach-profile/route.ts`) — `hasAcceptedPrivacyPolicy()` reads that
same column, so the old consent screen (`privacy-consent-form.tsx`)
simply never renders for anyone who onboards normally now.

**Real icons for both bubbles**, replacing generic/placeholder ones —
Carl supplied matched-set badge art for Pod Assist and Pod Coach (full
rounded-square badges, "POD ASSIST"/"POD COACH" text baked in, kept
alongside as `*-badge-full.png` for anywhere bigger is useful later).
Each was cropped (Python/PIL — divider-row detection then a tight bbox
scan for just the glyph cluster, transparent background) to a small
UI-sized mark, since the baked-in text is illegible at button size; "Pod
Assist"/"Pod Coach" as text lives in the label pill below each icon
instead, both now white-background/black-text (was gold/black
inconsistently, both mismatched a few iterations before landing here).
Bubbles switched from `fixed` to `absolute` positioning — Carl: a fixed
FAB that follows scroll meant a white label pill could float directly
over a white `card-light` tile below it and become unreadable; a dark
backing-plate alternative was tried and rejected ("i dfont like it")
before landing on absolute (scrolls away with the page, only visible
near the top) as the actual fix.

**Dashboard tile consistency** — Recovery/Sessions/Nutrition/
Recommendation/Habit cards restyled to match Leaderboard's
icon-centered layout (`HeartPulseIcon`/`DumbbellIcon`/`AppleIcon`/
`SparkleIcon`/`CalendarIcon` respectively) — same pattern already
applied to Home's Membership/Book-session cards earlier this session.

**Copy**: "Your habit" → "Main effort" (`member-habit-card.tsx`,
renders on both Home and Dashboard), "Today's mission" → "Today's
tasks" (`todays-mission-card.tsx`), and the "Your coach" card
(`coach-response-card.tsx`) removed from Home entirely — Carl: not
required, redundant with Pod Coach's own chat bubble. Component and its
data function (`getLatestCheckInResponse`) left in place, since the
check-in completion flow still uses both; only Home's render + now-dead
fetch were removed.

**Verified**: `tsc --noEmit` clean throughout, every change. Icon crops
and dark-plate-vs-absolute-positioning decision confirmed by direct
visual review (composited preview PNGs) rather than guessed at blind.
Full live click-through of the new onboarding→Dashboard→Coach-tour
sequence by Carl still outstanding as of this write-up — local dev
testing this session repeatedly hit the service-worker JS-chunk caching
issue (same one documented in the entry above), worked around each time
via DevTools Application → Storage → clear-and-unregister, not yet
fully confirmed clean end to end on Carl's own machine.

## Icon color revert; real Coach-tour bug found live; tour extended to Training/Nutrition — 2026-09-03

Same-day follow-up once Carl actually clicked through the above.

**Icons reverted**: the white-bg/black-icon treatment from the entry
above didn't survive contact — Carl: "I WANT THE ICONS BACK TO THE
ORIGINAL COLOUR." Both `pod-assist-mark.png`/`pod-coach-mark.png` are
white line art again (deleted the black-recolored variants entirely),
and the label pills underneath now read "POD ASSIST"/"POD COACH" in
full on white-background/black-text (was gold/black inconsistently
before) — the one piece of the white/black direction that stuck.

**The Coach tour's "Show me around" chip was genuinely invisible, not
just stale-cached** — worth recording precisely, since it looked
identical to this session's other caching false-alarms at first. Ruled
caching out for real this time (Incognito window, zero cached state,
still missing), then instrumented `coach-chat-view.tsx` with a
temporary on-page debug readout rather than keep guessing — it showed
`onReplayTour=true`, `isWelcomeOnly=true`, everything correct. Root
cause: the button's className used `text-foreground`/`border-card-border`
(dark-theme tokens, meant for the black page) inside Pod Coach's white
`card-light` chat panel — white text on white, present in the DOM the
whole render, just invisible. Fixed to the same light-context tokens
(`text-card-light-foreground`/`border-card-light-border`) Pod Assist's
own equivalent button in `help-chat-view.tsx` already used correctly —
a straight copy-paste would have avoided this. Debug code removed after
confirming the fix.

**Coach tour extended from Dashboard-only to a real cross-page tour** —
Carl, mid-walkthrough: "this is not it — you havent gone through the
training system or the nutrition." Same architecture as Pod Assist's
own cross-page tour (`tour-runner.tsx`/`tour-continuation.tsx`/
`tour-state.ts`), mirrored: `coach-tour-state.ts` (separate sessionStorage
key, `podCoachTourResumeIndex`), `coach-tour-continuation.tsx` (mounted
on `/training` and `/nutrition`, passive), `coach-tour-runner.tsx`
rebuilt to hand off between pages via `onDoneClick` (with the explicit
`driverRef.current?.destroy()` calls the Pod Assist debugging session
upstream already proved necessary, baked in from the start this time).
New sequence, 12 steps: Dashboard (week strip, recovery, sessions,
nutrition summary, recommendation, leaderboard) → Training (next
session, training block, consistency) → Nutrition (daily targets, log a
meal, done). Real anchors added on both pages
(`#tour-coach-training-next/-block/-consistency`,
`#tour-coach-nutrition-summary/-log`) — the nutrition summary anchor
needed its own inner wrapper div rather than reusing the outer
`card-light` container, which also held the meal log and would have
made the two steps' spotlights visually identical.

Also removed the "Your habit streak" Dashboard step (Carl: redundant —
the same Main Effort card already shows on Home) and the `#tour-coach-habit`
id it targeted.

**Verified**: `tsc --noEmit` clean throughout. The invisible-button root
cause was confirmed via live instrumentation, not guessed — the debug
readout's values were screenshotted before the fix. Dashboard's 6 steps
re-verified live via direct DOM inspection (correct order, glow on
every step); Training/Nutrition's cross-page hand-off itself hit the
same automation-tab `requestAnimationFrame` limitation again when
re-tested this way, but the resume pointer and page navigation were
confirmed correct, and Carl's own real-tab click-through afterward
("ok that will do!") confirms the full sequence actually works live.

## More meal suggestion variety — 2026-09-03

Carl: "I would like to add more options for what to eat next" →
"I want as much variety as possible." `meal-suggestions.ts`'s
`SUGGESTION_COUNT` (2 → 4, one idea per open meal slot on a day with
nothing logged yet, not always just two) and its top-up pass (was a
couple of fixed calls that could silently return fewer than asked for —
now loops until it actually reaches the count or the catalog's
exhausted). `meal-catalog.ts` doubled, 24 → 48 hand-written meals (12
per slot) — more proteins (pork, beef, prawns, halloumi), cuisines
(curry, fajitas, shakshuka), and vegetarian options, same
reviewed-not-runtime-LLM-generated convention as the rest of the file.
`tsc --noEmit` clean; not yet checked live.
