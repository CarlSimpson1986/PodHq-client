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
2026-08-15) have been moved to `ROADMAP-ARCHIVE.md`**, **2026-08-16
(OWASP audit) through 2026-08-19 (the Wellness/Recovery Room slot-duration
fix) have been moved to `ROADMAP-ARCHIVE-2.md`**, **the Stripe Connect
Hove pilot (2026-08-19) has been moved to `ROADMAP-ARCHIVE-3.md`**, **the
guided first-login tour and static FAQ, POD phase 1 (2026-08-21) have been
moved to `ROADMAP-ARCHIVE-4.md`**, and **POD phase 2, the real LLM chat
bot (2026-08-22), has been moved to `ROADMAP-ARCHIVE-5.md`** — all split
out to keep this file within Claude Code's ~15,000-character `@`-import
limit. All archives are reference-only (not auto-loaded by CLAUDE.md);
check them for full stage-by-stage build history. This file picks up from
the Hove AI Coach trial beta (2026-08-23) and is the active, auto-loaded
log going forward. If this file grows too large again, split it the same
way into a numbered `ROADMAP-ARCHIVE-6.md`, leave a pointer note at the
top of this file, and update this paragraph plus `CLAUDE.md`'s
session-handoff guidance to match.

## Hove AI Coach trial beta, Stage 1 — 2026-08-23

New initiative, separate from POD: a 7-day free AI Coach trial + tier
funnel, scoped down from the full `MyFitPod-App-Brief.docx` platform
rebuild to a beta specifically for Hove. Silver/Gold/Platinum differ only
by session-count allocation — every paid tier and every active trial gets
the identical AI Coach feature set (priority booking, Recovery Suite
gating, and challenge-tier pricing were explicitly stripped out as tier
differentiators after discussion). Nutrition, community challenges, the
full 1,300+-exercise GIF library, and push/email Heartbeat beyond one
trial-ending nudge are all deferred — this beta is only testing whether
the trial→subscription funnel converts. Full 5-stage plan agreed with the
user before building (`C:\Users\carls\.claude\plans\fluffy-sparking-fox.md`);
building and verifying one stage at a time, same discipline as every other
feature in this project.

Session also triggered by the user reviewing competitor screenshots (Zing
Coach) and asking specifically for its post-set RPE (rate-of-perceived-
exertion) mechanic — added to `MyFitPod-App-Brief.docx` itself first (two
new bullets in §9), then designed into this build's Stage 3 deterministic
weight-progression logic so it's real from day one, not bolted on later.

**Stage 1 — trial data model + activation mechanics, done and verified
live.** `podHq/supabase/migrations/0047_member_trial.sql`: three nullable
timestamps on `members` (`trial_activated_at`/`trial_started_at`/
`trial_expires_at`), same "nullable timestamp, not boolean" reasoning as
`tour_completed_at` (0045). `hasPremium(member)` (`src/lib/data/member.ts`)
combines trial-expiry with the existing `getActiveMembership()` check — no
changes to billing/webhook code at all. New `POST /api/member/start-trial`
stamps `trial_activated_at` (idempotent). Trial-clock hook added to
`src/app/api/bookings/route.ts`: deliberately gated on `trial_started_at
IS NULL` rather than reusing the route's existing "first booking ever"
count, since that would never fire for an existing Hove member with
booking history who activates the trial later — the null-gate means
"first booking since activating" instead, correctly and with no extra
query.

**Verified live** via a throwaway member/auth-user (cleaned up after):
confirmed the migration's columns exist, activated the trial, booked a
session (stamped both timestamps correctly, ~7 days out), booked a second
session (confirmed no re-stamp). First verification pass gave a false
"FAIL" from a test-script bug (strict string comparison of two
differently-formatted-but-identical timestamps — Postgres returns
`+00:00`, JS produces `Z`); fixed by comparing parsed epoch values instead,
which is what actually matters. `npx tsc --noEmit`, `eslint`,
`npx vitest run`, and `next build` all pass clean.

**Stage 2 — trial UI + four-state home screen, done and verified live.**
`src/lib/coach/trial-state.ts`'s `getCoachHomeState()` derives a
presentation-only state (`no_trial` / `trial_pending` / `trial_active` /
`trial_expired` / `subscriber`) from the member + membership rows the home
page already fetches — no new queries. Five states, not the brief's four:
`trial_pending` (tapped Start but hasn't booked yet, so the clock hasn't
started) needed its own copy so a member who already said yes isn't shown
the initial pitch again. `AICoachSection` (`src/components/ai-coach-section.tsx`)
renders each state; `no_trial` renders the new `TrialBanner`
(`src/components/trial-banner.tsx`) — banner → preview (three outcome
bullets, deliberately scoped to only what this beta actually builds, not
the brief's six including nutrition/community/HealthKit) → "Start my free
trial" → `POST /api/member/start-trial` → confirmation → `router.refresh()`.
`trial_active`/`subscriber` states don't fabricate workout stats (streaks,
PBs) since Stage 3/4 haven't built that data yet — just accurate status and
the next real action.

**Verified live end-to-end via a throwaway member** in the real browser
(Chrome, real login, real click-through — not just component review):
banner → preview → start trial → confirmation → home screen correctly
switched to `trial_pending`; booked a real session, home screen correctly
switched to `trial_active` with "7 days remaining" in the right accent
colour; `trial_expired` and `subscriber` states confirmed by directly
setting the same test member's DB fields and reloading (ghost-styled loss
-aversion copy, and "Gold member" in green with the redundant "Get Your
Membership" card correctly disappearing). Test member, booking, and
membership row all deleted after. `npx tsc --noEmit`, `eslint`,
`npx vitest run`, and `next build` all pass clean.

Stage 3 (coach profile + workout data model + deterministic RPE-based
progression engine) is next.
