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
fix) have been moved to `ROADMAP-ARCHIVE-2.md`**, and **the Stripe Connect
Hove pilot (2026-08-19) has been moved to `ROADMAP-ARCHIVE-3.md`** — all
split out to keep this file within Claude Code's ~15,000-character
`@`-import limit. All archives are reference-only (not auto-loaded by
CLAUDE.md); check them for full stage-by-stage build history. This file
picks up from the guided-tour/FAQ "POD" work (2026-08-21) and is the
active, auto-loaded log going forward. If this file grows too large
again, split it the same way into a numbered `ROADMAP-ARCHIVE-4.md`,
leave a pointer note at the top of this file, and update this paragraph
plus `CLAUDE.md`'s session-handoff guidance to match.

## Guided first-login tour ("POD"), phase 1 — 2026-08-21

First piece of the "POD" onboarding/FAQ assistant idea
(see podHq's memory notes — nothing previously built). Scoped down after
discussion with the user: build the scripted guided-tour half now, ahead
of Hove's launch, and defer the FAQ-bot half — a full RAG/tool-calling
agent isn't clearly needed yet for a single small gym, and a cheaper
static-FAQ version should ship first if/when real usage shows people
need it, rather than building the fancier version speculatively.

**Library: `driver.js`** (MIT-licensed, ~5kb, no dependencies) — chosen
over Intro.js (dual-licensed, needs a paid commercial license for a
business app) and Shepherd.js (heavier, no clear advantage here for a
mobile PWA).

**Persistence**: `members.tour_completed_at` (nullable timestamptz,
`0045_member_tour.sql` in podHq's shared migrations folder — applied and
verified live). Null means "never seen it" — auto-launches once
regardless of device, then stays off. New `POST /api/member/tour-complete`
route (session-validated, rate-limited, same pattern as every other
member-write route) marks it complete.

**v1 scope: home screen only**, deliberately not cross-page, to avoid
tour-state-across-navigation complexity for a first version: greeting →
credits available → next-session card → Book/Shop/Profile bottom-nav
icons → a persistent "?" button (`onboarding-tour.tsx`) that replays it
on demand afterward. That same "?" button is the intended future home for
the FAQ bot half of POD once that gets built — confirmed with the user
this is the same icon from the original scoping, not a new one.

**Verified live end-to-end** via a throwaway test member
(`podhq-test-tour@example.com`, gym: Aylesbury Berryfields) through the
real UI, not just the build: all 7 steps highlighted the correct element
with sensible copy; "Done" correctly wrote `tour_completed_at`; reloading
the page did **not** re-launch the tour; the "?" button correctly
replayed it manually afterward. Test account and verification scripts
deleted after. `npx tsc --noEmit`, `eslint`, and `next build` all pass
clean.

**Known minor inefficiency, not fixed**: the "?" button's `onDestroyed`
handler decides whether to call the completion API from the
`tourCompletedAt` prop captured at mount — correct across page loads, but
if a member manually replays the tour on the *same* page load where they
just completed it for the first time, it re-fires the (idempotent, harmless)
completion POST a second time. Not worth the added complexity of tracking
a separate "already marked" flag for a one-extra-request edge case.

**Same-day follow-up: static FAQ built, the "?" icon now a menu.** Second
half of this session's POD work — the deferred FAQ piece, scoped down to
a genuinely static list (no LLM, no ongoing cost) per the earlier
discussion: build the cheap version first, only invest in a fuller RAG/
tool-calling agent if real usage shows it's needed. Content sourced from
the three questions Hove staff actually report members asking most
(`src/lib/faq.ts`), not guessed — cancellation, the 2-hour booking-credit
cutoff, and the under-16 waiver policy (the last one required reading the
franchisee's actual waiver PDF, which turned out to be a generic adult
waiver template that had never actually been adapted — no age threshold,
no parent/guardian signature line. Flagged to the user directly rather
than drafting FAQ copy off a document that didn't state the real policy;
the real policy came from the user directly, not the document).

New `/faq` page (`faq-view.tsx`, single-open accordion, same auth/
`PageHero`/`BottomNav` pattern as every other member page), and the "?"
button (`onboarding-tour.tsx`) is now a small menu — "Replay app tour" /
"FAQ" — rather than immediately replaying the tour, since both now live
behind the same icon as originally scoped. Replaying the tour from `/faq`
navigates home and force-launches it there via a `?tour=replay` query
param, since the tour's steps target home-screen-only elements.

**Two real bugs found and fixed during live testing, not just built and
assumed working:**
- A hydration-mismatch/ordering bug in the `?tour=replay` handler —
  calling `router.replace()` to strip the query param *before* the tour
  had actually started risked a race where the URL-driven re-render
  interfered with the pending timer. Fixed by only stripping the param
  *after* `driver().drive()` runs, both inside the same `setTimeout`
  callback.
- **A stale service worker serving old JS to the browser even after
  clearing `.next` and hard-reloading** — this app's PWA service worker
  (`sw.js`) was still registered from an earlier local dev session, and
  because Next dev doesn't content-hash chunk filenames the way a
  production build does, a cache-first SW kept serving the exact same
  chunk URL with stale bytes through every reload. Symptom was a
  React hydration-mismatch error showing genuinely old component output
  (the pre-menu-redesign single-button version) fighting the correctly
  updated server-rendered HTML. Fixed for this testing session by
  unregistering the service worker and clearing the Cache Storage
  directly via devtools JS — not a code bug, but a real local-dev gotcha
  worth remembering (same class of issue as Stage 28's stale-chunk note,
  this time traced to its actual root cause rather than just "hard
  reload fixed it").

**Verified live end-to-end** via a second throwaway test member
(`podhq-test-faq@example.com`): "?" menu opens correctly with both
options; FAQ page renders all three questions with accurate content;
accordion correctly shows one answer open at a time; "Replay app tour"
from the FAQ page correctly navigates home and launches the tour there.
Test account and scripts deleted after. `npx tsc --noEmit`, `eslint`, and
`next build` all pass clean.

## POD phase 2: real LLM chat bot + Ts & Cs knowledge base — 2026-08-22

Graduates POD's FAQ half from the static accordion (above) to a real
chat, per the original 2026-08-20 scoping note ("build the cheap version
first, only invest in a fuller RAG/tool-calling agent if real usage shows
it's needed") — decided this session it's time. Deliberately still Q&A
only, no tool-calling into the member's own bookings/credits (confirmed
with the user) — that stays a future phase if ever needed.

New `/help-chat` page + `HelpChatView`, reachable from the "?" menu (now
Replay app tour / FAQ / **Chat**). `askHelpBot()` (`src/lib/help-bot.ts`)
is provider-swappable so testing-for-free doesn't require a rebuild before
launch: `GROQ_API_KEY` (free tier, no commercial-use restriction) is tried
first, falling back to `ANTHROPIC_API_KEY` (Claude Haiku 4.5, ~£10-15/mo
across all 9 gyms per the earlier cost scoping) — switching to launch is
just removing the Groq key from Vercel env. Session-validated + rate-
limited at 15 msgs/min (tighter than the usual 100/min default, since this
route costs real money per call once on the paid key) via a new optional
third arg on `checkRateLimit()`. Input capped at 500 chars/6 turns of
history, bounding both cost and abuse.

**Closed-book by design, not RAG**: with only a handful of policies, the
entire knowledge base (FAQ + full Terms & Conditions) is stuffed directly
into the system prompt every request rather than using embedding-based
retrieval — genuine semantic understanding comes from the LLM reading the
full text each time, not a search step. Documented as a real future limit
if the FAQ/Ts&Cs ever grows to dozens+ entries, not a problem at this
size.

**Full Terms & Conditions added as a second knowledge source**
(`src/lib/terms-and-conditions.ts`) after the user confirmed they'd
already supplied it — found via three copies in Downloads
(`My Fit Pod Ts & Cs.pdf`, dated 2025-05-28/2025-10-20/2026-08-11) which
turned out to be byte-identical, so no version reconciliation was needed,
just a transcription.

**Real discrepancy found reading it, not assumed away**: the document's
own printed Cancellation Policy (Clause 9 — 4hrs Packages/Membership, 8hrs
PAYG, £5 membership late fee) didn't match either the app's FAQ text or
the actual `cancel_booking()` RPC (both said a flat 2 hours at the time).
Flagged to the user rather than picking one silently. User first confirmed
the app's 2-hour figure was correct and the document needed fixing
separately — then, prompted by a follow-up mention that GymFlow's real
policy is 3 hours, corrected course: **the app itself had the wrong
number**, not just the legal document.

**Fixed end-to-end, not just in the chat bot's knowledge** — this touches
real credits/money on real bookings, so every hardcoded "2 hour" reference
across both repos was found and corrected to 3, not just the chatbot text:
`cancel_booking()` RPC (podHq migration `0046_cancel_booking_3hr_window.sql`,
superseding 0020/0039's 2-hour version — DB write left for the user to run
themselves in the SQL editor, not scripted), `bookings-view.tsx`'s
client-side `CANCELLATION_CUTOFF_MS` hint (shown before confirming — the
DB function remains the real enforcement) and its two confirm-dialog
strings, `notifications/templates.ts`'s cancellation email copy, and
`faq.ts`'s FAQ answer. The system prompt explicitly tells the model the
Ts & Cs document's Clause 9 is outdated and to always defer to the FAQ's
3-hour answer specifically on cancellation questions, so the full-document
knowledge source can't resurface the wrong numbers.

The Ts & Cs document itself (the real one members legally agree to) still
has the wrong cancellation clause printed in it — that's a separate,
not-yet-done task: updating the actual legal document, outside this app
entirely.

`npx tsc --noEmit`, `eslint`, and `next build` all pass clean across every
file touched.

**Click-tested live 2026-08-22, same session, three real bugs found and fixed along the way:**

1. **Groq model name was stale.** `llama-3.3-70b-versatile` no longer exists on Groq's API (404 `model_not_found`) — their lineup has moved to GPT-OSS models since. Confirmed the real current list via `GET /v1/models` and switched to `openai/gpt-oss-120b`.
2. **UI redesigned mid-session, at the user's request, from a full `/help-chat` page to a floating bubble/panel** — same "Chat" menu item in the "?" menu now toggles an in-place overlay (`onboarding-tour.tsx`, `chatOpen` state) instead of navigating away. `HelpChatView` changed from a fixed `max-h-[55vh]` to `h-full flex-1`, so it works correctly sized inside either a full page or a small floating panel. The now-unreachable `/help-chat` page and route were deleted rather than left as dead code.
3. **Real member-signup UX gap found while getting a test account**: signing up with an email that already exists anywhere in the system (e.g. staff's own admin login) silently switches from a normal signup confirmation to a "prove you own this inbox" sign-in link — same generic "Check your email to confirm your account" message either way, so there's no way to tell which happened from the screen. Not fixed this session (out of scope for the chat-bot task), but worth a distinct message for the two cases. Separately, that magic-link email's `emailRedirectTo=http://localhost:3000/...` didn't take — it redirected to production instead, the same class of bug as Stage 26's Site-URL/redirect-allowlist issue (`http://localhost:3000` likely isn't in Supabase's Additional Redirect URLs). Also not fixed this session.

Verified live end-to-end via the user's own real account (their staff email already existed in the system, so this incidentally became a real-account test rather than a throwaway one — see point 3): the floating panel opens without navigation, "how long before my session do I need to cancel to get my credit back" correctly answered **3 hours** (not the Ts & Cs document's wrong 4/8-hour numbers), and "can I bring my 12 year old" correctly matched to the under-16 waiver policy despite sharing no words with the FAQ's actual question text — real confirmation the closed-book/full-context approach understands rephrased questions, not just exact matches.

**Static FAQ page removed, same session, same day.** Once Chat had graduated to a real LLM covering the same 3 questions plus the full Ts & Cs, keeping a separate static FAQ was redundant menu clutter rather than useful redundancy — user agreed once asked directly. Deleted `/faq` (page), `faq-view.tsx`, and `replay-tour-button.tsx` (both only ever used by that page); the "?" menu is now just Replay app tour / Chat. This also retired the `?tour=replay` cross-page query-param mechanism entirely — it existed solely so the FAQ page's own replay button could force-launch the tour on `/`, and `OnboardingTour` is now the only place with a "?" button at all. `FAQ_ITEMS` (`src/lib/faq.ts`) is untouched — still the chat bot's base knowledge, just no longer has its own standalone page. Verified live: menu shows exactly two items, `/faq` 404s, `npx tsc --noEmit`/`eslint`/`next build`/`npx vitest run` all pass clean.
