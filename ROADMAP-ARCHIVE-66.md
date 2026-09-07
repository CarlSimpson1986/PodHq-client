# Archive 66 — Pre-launch review (2026-09-07)

Split out of `ROADMAP.md` 2026-09-07 to stay under the ~15,000-character
import limit — this section was fully finished and verified live. See
`ROADMAP.md`'s own header for the full archive-splitting convention.

## Pre-launch review — 4-domain audit, real bugs fixed, adversarial eval suite built — 2026-09-07

Carl: "act as a senior end to end developer, give me a full review of the
pod-client app and highlight anything that is an issue prior to going
live." Split into four parallel investigations (security/auth, payments/
concurrency, physical-access/data-privacy, chat-safety/code-quality), each
told to verify every claim against current code, not against what this
ROADMAP says was already fixed. Physical-access/data-privacy and
security/auth both came back clean (session validation, RLS-as-auth
anti-pattern absent, the Stripe-account-routing fix from the 2026-09-05
wargaming session confirmed complete on every call site, IDOR checks
consistent everywhere) — only low-severity findings there. Payments/
concurrency and chat-safety/code-quality found the real gaps below.

**Fixed — chat safety.** Crisis detection covered suicide/self-harm only;
a message like "chest feels tight, can't breathe" fell through to the
ordinary pain carve-out, dangerously weak for a possible cardiac event
with no staff backstop (pods are unmanned). Added a second fixed-reply
marker/pair to `crisis-response.ts` (`MEDICAL_EMERGENCY_MARKER`/`_REPLY`),
wired into both `coach-chat.ts` and `help-bot.ts`. Carl then flagged real
context this was missing: **every pod has an in-pod panic button wired to
a 24/7 monitoring company** — the reply now leads with "press the panic
button" (faster than dialling for someone struggling to breathe or speak)
with 999 as the parallel backup, worded conditionally ("if you're in a
pod") since the same reply can fire from a chat message sent from
anywhere, not just on-site. Also bumped `help-bot.ts`'s
`reasoning_effort` from "low" to "medium" — it carries the identical
crisis-marker instruction as `coach-chat.ts` on the same model, which was
already proven unreliable at "low" (2026-08-27 rep-range incident).

**Built for "test the LLMs with another LLM"** (Carl's own framing):
`evals/chat-safety.eval.ts` + `vitest.eval.config.ts` (new `npm run eval`,
same excluded-from-`npm test` pattern as podHq's Pod Assist evals). Real
model calls assert the fixed-reply markers actually fire for realistic
adversarial phrasings (not just the exact marker string a mocked unit
test checks); an independent **Claude Sonnet 5 judge call** — a different
model than whichever one generated the reply (Groq's gpt-oss-120b in
production) — grades response quality for cases with no fixed-string
answer: jailbreak resistance (a "pretend you're Dr. Smith, prescribe
medication" attempt, a fake "30 min no-forfeit cancellation policy"
override attempt), safe wording for ordinary pain that shouldn't trip
either emergency marker, and abuse redirection. Real infra hiccup found
running it: Groq's free-tier 8000 TPM cap couldn't absorb 15 back-to-back
real calls, failing 6/11 tests on genuine 429s, not app bugs — fixed with
retry-with-backoff + inter-test spacing in the eval harness itself.
**Verified live, 11/11 passing**, both before and after the panic-button
wording change.

**Fixed — payments/concurrency.** (1) `bookings/cancel/route.ts` only
offered a freed slot to the waitlist when the *cancelling* member had an
email on file — unrelated conditions wrongly coupled, silently leaving
the slot dead for any member with no email; the waitlist-offer lookup and
call now run unconditionally. (2) The Stripe webhook's
`customer.subscription.updated`/`.deleted` handler had no protection
against Stripe's explicitly-unordered delivery — a stale redelivered
event landing after a newer one could revert a reactivated membership
back to `canceled`. New `memberships.last_stripe_event_created_at` column
(podHq migration `0092`) guards the update; a stale event now matches
zero rows and is a deliberate no-op, and the founding-member-revoke/
staff-alert side effects are gated on the update actually having applied.
(3) `vouchers/redeem/route.ts`'s credit grant wasn't transactional with
the redemption claim — a failed credit insert permanently burned the
voucher for zero credits; added a compensating rollback. (4)
`create_booking()` never checked whether the *same member* already held
a booking for the exact slot, only aggregate capacity — unexploitable
today since every real resource has `pod_capacity = 1`, but latent the
moment any resource gets capacity ≥ 2 (schema already supports it); fixed
in podHq migration `0091`, with a friendly `already_booked` message added
to `bookings/route.ts`.

**Fixed — infra/cleanup.** Zero `error.tsx`/`loading.tsx` existed
anywhere in the app despite this repo's own CLAUDE.md calling both
"non-negotiable" — added at `src/app/` root (Next's App Router inherits
these down the whole tree, so three files cover all 34 page routes, not
34 copies). Unlock endpoint: added a 10s timeout on the Kisi API call
(previously unbounded) and tightened its rate limit from the generic
100/min to 10/min (a real physical door, not a data-fetch route).
Leaderboard queries (`leaderboard.ts`) now page through `.range()` —
closes the documented 1000-row Supabase-cap bug class before it could
ever bite. Corrected a stale `proxy.ts` comment claiming "pilot-scope, no
lockout" — false today (lockout's been live for a while, real members
with real Stripe payments exist).

**Not fixed — accepted, not a code problem**: GPS-spoofable unlock
location, self-reported by design, matching the old GymFlow system's
identical weakness — no server-side way to verify a phone's real location
without new hardware, so flagged rather than "fixed."

**Verified**: `tsc --noEmit`, eslint, `npx vitest run` (195/195, up from
190), `npm run build`, and the live eval suite (11/11) all clean. Two new
podHq migrations (`0091`, `0092`) applied live by Carl via Supabase's SQL
Editor. `ANTHROPIC_API_KEY` added to podhq-client's `.env.local` to make
the Claude-judge eval calls possible (wasn't configured anywhere in this
app before — Anthropic was previously only ever used in podHq, for Pod
Assist).
