# Archive 61 — Icon color revert; Coach tour cross-page extension (2026-09-03)

Split out of `ROADMAP.md` 2026-09-06 to stay under the ~15,000-character
import limit — this section was fully finished and verified live (Carl's
own real-tab click-through confirmed the full tour sequence). See
`ROADMAP.md`'s own header for the full archive-splitting convention.

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

## Manual "worked out anyway" workout log — 2026-09-04

Continuation of the 2026-09-03 session, which drafted and applied
`member_workout_manual_logs` (podHq's `0083`, shared DB) but left the
migration file uncommitted in podHq and never built this side. Picked
back up 2026-09-04: `src/lib/coach/workout-manual-log.ts` (get/log/undo,
same insert-only + same-day-only-delete convention as `habit_logs`),
`/api/member/workout-manual-log` (POST/DELETE, same session/rate-limit/
member-lookup shape as every other member route), and
`todays-mission.ts`'s `no_booking` workout state extended with a
`manuallyLogged` flag.

`todays-mission-card.tsx`'s Workout row (no-booking case) changed from
a single `Link` wrapping the whole row to a tickable `StatusDot` button
(same look/behaviour as `DailyHabitsCard`'s tick/untick) plus a separate
`/training` preview `Link`, so ticking and previewing don't fight over
the same tap target.

**Verified live**: `tsc --noEmit`, eslint, and `npx vitest run`
(178/178) all clean. Logged into local dev as Carl's own real
trial-active Hove account — ticked the Workout dot (POST 200, dot went
green, text → "Logged today — preview →"), reloaded the page fresh to
confirm the server-rendered state persisted (0/4 → 1/4 today), then
undid it (DELETE 200) and reloaded again to confirm it reverted to
0/4. Full round trip confirmed against the real DB, not just optimistic
client state.
