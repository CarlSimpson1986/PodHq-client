# Archive 60 — Premium onboarding overhaul (2026-09-03)

Split out of `ROADMAP.md` 2026-09-04 to stay under the ~15,000-character
import limit — this section was fully finished and verified (see the
"Icon color revert; real Coach-tour bug found live" entry that followed
it in the active file, which resolved its one outstanding item). See
`ROADMAP.md`'s own header for the full archive-splitting convention.

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
