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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-20.md`, covering the pilot
mechanism proof (2026-08-05) through the nav-context-switch fix and
nav-lag investigation (2026-08-25) — all split out to keep this file
within Claude Code's ~15,000-character `@`-import limit. Archives aren't
always the strictly oldest material — the split point is "what's
finished and stable" as much as "what's oldest" (see
`ROADMAP-ARCHIVE-14.md`'s, `-15.md`'s, `-16.md`'s, `-17.md`'s, `-18.md`'s,
`-19.md`'s, and `-20.md`'s own header notes for same-day examples of
this). All archives are reference-only (not auto-loaded by CLAUDE.md);
check them for full stage-by-stage build history, or `git log` on this
file for the exact split points. This file's active content is the
equipment-aware AI Coach work (2026-08-24) plus whatever's added after
it. If this file grows too large again, split it the same way: move
whichever section is most clearly finished (not necessarily the
chronologically oldest) into a numbered `ROADMAP-ARCHIVE-21.md`, leave a
pointer note at the top of this file, and update this paragraph.

## Equipment-aware AI Coach workout generation — 2026-08-24

Shipped and verified — full detail moved to `ROADMAP-ARCHIVE-14.md` the
same day, to make room for the still-active wearable-integration research
above. Summary: `pod_resources` gained an `equipment` column (empty =
unrestricted, today's exact behavior); `generateWorkout`/`swapExercise`
now filter/re-validate against a resource's configured equipment; podHq's
pod Settings panel gained equipment checkboxes. **Still outstanding**: no
gym's equipment has actually been set yet (including Hove's already-
confirmed real equipment) — every gym runs unrestricted until Carl works
through the Settings panel gym by gym.

## Client-side page cache for bottom-nav tabs — 2026-08-25 (same day, later)

Carl still noticed a slight residual lag and asked whether a native app
would be less laggy; the honest answer was "somewhat, but mostly because
native screens don't wait on a network round trip to render the nav
shell" — closeable on the web side with a client cache instead of a
native rewrite. Carl asked for that cache layer.

Enabled via Next 16's built-in `experimental.staleTimes.dynamic: 30` in
`next.config.ts` — once a member has visited a dynamic page (Dashboard/
Training/Nutrition/Coach etc.), Next's in-memory Client Router Cache
reuses that RSC payload for 30s on revisits instead of re-fetching, so
bouncing between recently-visited bottom-nav tabs feels instant. No page
components changed — this is pure Next router config, still fully
server-verified Server Components, no client-side Supabase queries
(CLAUDE.md's rule intact).

**Real risk found and fixed before enabling it**: the Client Cache is
in-memory per browser tab, keyed by route, not by member. Per Next's own
docs, `router.refresh()` only clears the cache for its *own* destination
route, not other previously-visited ones, and nothing at all clears it on
a plain `router.push()`. Every one of this app's auth-identity-changing
navigations (login, both logout entry points, password reset, magic-link
callback) used exactly that pattern — meaning a member logging out and a
different member logging in on the same device within that 30s window
could have briefly been served the first member's cached Dashboard/
Training/Nutrition data. Same bug class as the 2026-08-16 OWASP finding
that made `public/sw.js` allowlist-only, just via Next's router cache
instead of the service worker's. Fixed by switching all five of those
transitions from `router.push`/`router.refresh` to a real
`window.location.href` navigation — the Client Cache is documented as
"cleared on page refresh", which a full reload guarantees outright.
Touched files: `login/page.tsx`, `reset-password/page.tsx`,
`auth/callback/page.tsx`, `profile-view.tsx`, `no-member-profile.tsx`.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98),
`next build` all clean. Live: logout confirmed landing cleanly on
`/login` with a real full-page reload (not a client transition). Login/
reset-password/callback weren't re-tested live (no test-account password
in this session) but follow the identical, now-proven pattern.

**Update, same day**: spotted a leftover unguarded `/book` prefetch on
Training while checking the above and swept the rest of the codebase for
the same original prefetch-storm pattern — Training's next-session card,
Health's Nutrition/Training cross-links, Coach's check-in card, Home's
leaderboard card, and the shared `ai-coach-section.tsx`/
`recovery-status-card.tsx` components (rendered on Home/Dashboard/Health)
all still had eager prefetch on. Same fix, all now `prefetch={false}`.

## POD chat fixes: dead in production, invisible input text, tour-replay chip — 2026-08-26

Carl reported the "?" chat ("POD", `help-chat-view.tsx` /
`src/lib/help-bot.ts`) didn't work at all live, plus the chat's own text
input showed typed text in white (invisible against the panel).

**Root cause of the dead chat — not a code bug**: `askHelpBot` throws if
neither `GROQ_API_KEY` nor `ANTHROPIC_API_KEY` is set, and podhq-client's
Vercel project had never had either — `GROQ_API_KEY` was only ever
configured for the sibling `../podHq` project, and (being a fully
separate Next.js app/deploy per this file's own header) podhq-client
needed its own copy, which it never got. Confirmed locally first (a
throwaway Node script loaded `.env.local` and called the real Groq
endpoint directly — 200 OK, valid reply — ruling out the prompt/logic
itself), then confirmed via `vercel env ls production` that the key was
absent from this project specifically. Fixed by adding `GROQ_API_KEY` to
this project's Production (and initially Preview, though Carl later said
Vercel only let him pick one scope at a time when he went to configure
it himself, so Preview may still need doing manually — Production is
what live members hit and is confirmed set).

**Invisible input text**: `help-chat-view.tsx`'s `<input>` never set a
text colour, so — sitting inside the white `.card-light` panel while the
rest of the app is dark-themed white-on-black — it inherited the global
white body colour with no background override, i.e. white text with no
opaque background under it. Fixed by adding `text-card-light-foreground`
(the pattern already used in `buy-credits-list.tsx` etc.).

**"Replay app tour" as a chat question**: added a quick-question chip
row shown when the chat is empty — "Replay app tour" plus the 3
`FAQ_ITEMS` questions. Tour replay is a UI action the LLM can't perform,
so that chip bypasses the API entirely and calls the same `driver.js`
`.drive()` the existing "?" menu item already uses, via a new
`onReplayTour` prop passed down from `onboarding-tour.tsx`; the FAQ
chips send their question straight into the existing chat flow.

**Verified**: `npx tsc --noEmit` and `eslint` on both changed files clean.
Not yet re-tested live post-deploy (no test-account password in this
session, same limitation as the 2026-08-25 client-cache session).

**Friction, worth noting**: this session ran `vercel env ls production`
to diagnose the missing key, which surfaces variable *names* (not
values — Vercel's CLI shows `Hidden` for every value). Carl reacted
strongly to seeing even just names of production env vars in the
conversation without being asked first, despite no value ever being
displayed or logged. Going forward: always ask before running any
`vercel env ls/add/rm` (or equivalent) against either Vercel project,
even for a read-only names-only listing.

## Continuous-improvement loop for POD chat: FAQ moved to a DB, unanswered questions logged — 2026-08-26 (same day, later)

Carl asked how to stop the help chat ("POD") dead-ending members with "not
sure, ask staff" and nothing captured anywhere — framed as "how big
companies do continuous improvement." Landed on: the FAQ moves off the
static `src/lib/faq.ts` array into a DB table admin can edit live
(`help_faq_items`, no redeploy needed), and every question the bot
couldn't answer gets logged + emailed to gym staff immediately, reviewable
in a new `/chat-questions` page in `../podHq` (full detail there).

**Detection**: `help-bot.ts`'s system prompt now tells the model to end
an unanswerable reply with a hidden `<<STAFF_FOLLOWUP>>` marker (never
shown to the member) rather than asking for structured JSON output, which
the Groq/Anthropic calls here aren't set up for. `askHelpBot` now returns
`{ reply, needsStaff }`; `help-chat/route.ts` strips the marker, and on
`needsStaff` awaits (not fire-and-forget) a log insert
(`src/lib/data/help-chat-questions.ts`) plus a staff email — reusing
`getStaffRecipients`/`notifyFireAndForget`, the same infrastructure
`staff_new_signup` etc. already use, just a new `unanswered_chat_question`
event type and template, not a second notification path.

**FAQ off the code file**: `src/lib/data/help-faq.ts` (new) reads
`help_faq_items` via the service-role client; `src/lib/faq.ts` deleted.
The chat's own quick-question chips (added earlier this session) now
fetch from a new `/api/member/help-faq` route instead of a static import,
since `help-chat-view.tsx` is a client component and can't read the
server-only data layer directly.

**Shared-schema change, flagged in both apps**: new migration
`0063_help_faq_and_chat_questions.sql` lives in `../podHq`'s
`supabase/migrations/` per this file's own convention — **written this
session, not yet applied**. Carl runs migrations himself via the Supabase
SQL Editor; a Claude session has no DB DDL access, so this doesn't work
at all until he does. `../podHq`'s own ROADMAP has the full write-up of
the new `/chat-questions` admin page (review queue + FAQ CRUD).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean. **Confirmed live**: migration applied by Carl via
the Supabase SQL Editor, then genuinely exercised the same session — a
member question the bot couldn't answer confidently (cross-gym
membership use, see below) correctly triggered the `<<STAFF_FOLLOWUP>>`
marker, landed in podHq's Chat Questions queue, and the staff email
arrived — the full loop working end to end, not just a clean build.

## Cross-gym PAYG booking + Access-log visiting-member fix — 2026-08-26 (same day, later)

Prompted directly by the POD chat loop above doing its job: it flagged a
member's "can I use my membership at other gyms?" question as
unanswered, and Carl mentioned a few members had asked this before —
real, repeated demand, not a one-off. Confirmed real policy first:
membership is meant to be locked to one home gym (matches what the app
already does — every booking write is gym-scoped to `member.gym`).
Scoped to **PAYG only** — a subscription membership's `sessions_per_week`
capacity planning assumes members drawn from that gym's own catchment
(same reasoning the leaderboard's per-member streak target already
documents), so opening *membership* access network-wide risks
oversubscribing a popular gym; PAYG credits carry no such assumption —
confirmed the `credits` table has no `gym` column at all, and
`create_booking()`/`cancel_booking()` (`0039_pod_resources_functions.sql`)
already derive gym from the resource row, not from a trusted parameter —
so cross-gym PAYG booking needed **no RPC or migration changes at all**,
only loosening the app-layer restriction that never let a member browse
or book any gym but their own.

**Money stays put**: Carl was explicit — the gym a member buys PAYG
credits from keeps that revenue regardless of where the credit later
gets spent; not touched (`checkout`'s Stripe Connect routing is still
keyed on `member.gym`, unrelated to booking). What he did want: visibility
into which gym actually *hosted* a session, separate from which gym sold
the credits — `bookings.gym`/`waitlist_entries.gym` already capture the
hosting gym correctly once cross-gym booking works (no schema change
needed), surfaced as a "(visiting from X)" tag wherever `../podHq` shows
a booked/waiting member (Calendar's slot detail panel) — full detail in
`../podHq`'s own ROADMAP, including a real pre-existing bug this surfaced
in the Access log.

**Changed**: `/book` accepts `?gym=` for PAYG members only (server-derived
`canSwitchGym` from `getActiveMembership`, not trusted from the client);
`BookingGrid` gained a gym-switcher `<select>` (PAYG-only) and an empty
state for a gym with no bookable resources configured yet.
`/api/bookings` and `/api/waitlist` replaced their "resource must belong
to `member.gym`" check with "must belong to `member.gym`, OR the member
has no active membership" — new `getPodResourceById()` (not gym-scoped,
unlike the existing `getPodResourcesForGym()`) backs this. Booking/
cancellation confirmation emails now say the resource's/booking's own
gym, not `member.gym` — those could silently diverge once cross-gym
booking is possible.

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (98/98), and
`next build` all clean in both repos. **Not yet tested live** — no
test-account password in this session (same limitation as the
2026-08-25 client-cache session); the underlying mechanism (booking by
`resourceId` alone, gym-agnostic) is exactly what `create_booking()`
already does today for every existing booking, so the main untested
surface is the new UI/authorization layer, not the RPC path itself.
