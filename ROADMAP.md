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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-58.md`, covering the pilot
mechanism proof (2026-08-05) through the cross-page tour rework
(2026-09-02) — all split out to keep this file within Claude Code's
~15,000-character `@`-import limit. Archives aren't always the strictly
oldest material — the split point is "what's finished and stable" as
much as "what's oldest" (see each archive's own header note for
examples). Reference-only, not auto-loaded by CLAUDE.md; check them for
full build history, or `git log` on this file for exact split points.
Active content here starts at "Tour: glow, step order, door-access
copy, broken Done/X" (2026-09-03). If this file grows too large again,
split it the same way: move the most clearly finished section into
`ROADMAP-ARCHIVE-59.md`, update this paragraph.

## Tour: glow, step order, door-access copy, broken Done/X — 2026-09-03

Carl walked the tour live and flagged four real problems in one pass:
no visible glow around Pod Assist, a distracting full-width pulsing bar
on some steps, an out-of-order step sequence ("2/6 goes from [credits]
to [session card] doesn't flow"), and — the big one — **the popover's
own Done and X buttons didn't do anything**.

**Glow was never actually reachable.** It had been wired as a `glowing`
prop threaded through `OnboardingTour`, which only Home ever had a path
for — `/shop` and `/book` had no wiring at all. Even on Home it was
invisible in practice: driver.js's dimming overlay (`z-index: 10000`)
painted over the icon's old `z-20` wrapper for every step except the one
literally targeting it. Replaced the prop-threading with direct DOM
class toggling in `tour-runner.tsx` (`setPodAssistGlow`, keyed off the
icon's stable `id`, so it works from wherever `TourRunner` mounts — Home,
`/shop`, or `/book` alike) and raised the icon's z-index above driver.js
entirely (`z-[2000000000]`, with `pointer-events-none` on the wrapper and
`pointer-events-auto` on the actual interactive children, so its now-huge
hit area can never swallow a click meant for a popover positioned nearby).
Also dropped the glow from arbitrary highlighted step targets (a `<p>`
spanning the full card width read as a stretched pulsing bar, not a
highlight) — scoped to just the Pod Assist icon, per Carl's call.

**Step order** (`tour-steps.ts`) reordered to match Home's actual
top-to-bottom layout — was greeting → credits (bottom of page) → session
card (back near the top) → leaderboard → find-professional, now
greeting → session card → leaderboard → find-professional → credits →
shop hand-off.

**Door-access step** now warns members before they book, using the real
rules from `unlock-window.ts`/`api/unlock/route.ts` rather than
undersetting it as automatic: "The door only unlocks from 5 minutes
before your session, and only once you're physically at the gym."

**Done/X root cause** (not a styling issue): driver.js skips its own
default close/advance behavior *entirely* once you supply a custom
`onDoneClick`/`onCloseClick` — your callback is expected to call
`.destroy()` itself. None of `tour-runner.tsx`'s three handlers ever
did. X had been broken on every single step since this was built (its
handler is always overridden); Done only broke on the tour's true final
step (every other "Next" was still hitting driver.js's own untouched
default, which is why step-to-step progress always looked fine).
Fixed by adding the missing `driverRef.current?.destroy()` calls. Also
retargeted the final step at a new non-interactive `#tour-help-label`
span instead of the live, real `#tour-help-button` itself — highlighting
an element with its own click handler in the same corner driver.js's own
popover renders in was exactly the kind of setup that causes buttons to
stop responding.

**Also this session**: `sw.js` had `"/"` in its cacheable-navigation
allowlist — Home is the most member-specific page in the app ("Hello,
{name}"), and caching it directly violated the file's own rule (written
after the 2026-08-16 OWASP audit) that non-public pages must never be
served stale; a deleted/logged-out member's browser could keep serving
their old cached dashboard. Removed, `CACHE_VERSION` bumped to purge the
existing bad cache. Membership/Book-session Home cards restyled to match
the icon-centered layout already used by Leaderboard/Find-a-professional;
Leaderboard, Find-a-professional, and Gift Voucher (which had no tour id
at all) added to the guided tour. Trial banner's collapsed line and the
first-login welcome message copy adjusted for accuracy and tone.

**Verified**: `tsc --noEmit` clean throughout. Glow and step-order fixes
confirmed live in local dev via direct DOM inspection through a full
Home walk-through (six steps, glow `true` on every one). The Done/X fix
was verified live the same way for X (popover and overlay both removed
on click, glow correctly cleared) — the true-final-step Done button
specifically couldn't be exercised end-to-end in this session: reaching
it requires the cross-page resume in `tour-continuation.tsx`, which is
gated on `requestAnimationFrame` and never fired against an automated,
unfocused browser tab (confirmed via `document.hasFocus()` /
`visibilityState: "hidden"` — not a product bug, a limitation of testing
via an unfocused automation tab). Same destroy() fix, proven working for
X; a real end-to-end click-through by Carl is the outstanding check.

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
