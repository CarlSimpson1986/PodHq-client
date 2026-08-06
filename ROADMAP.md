# PodHQ Client — Pod Booking & Kisi Unlock

Staged build order, same philosophy as `../podHq`'s ROADMAP.md: guide the
user through each stage step by step, ask before proceeding on anything
that could go multiple ways, confirm each stage works before moving to the
next. Don't jump ahead to a later stage unprompted.

Sibling project to `../podHq` (the admin/owner analytics app) — this is the
member-facing PWA: book a pod session, unlock the door via Kisi. Reuses
podHq's Supabase project (same `SUPABASE_URL`/keys) and its dark/gold
Tailwind theme, but is a fully separate Next.js app with its own repo and
deploy. Target scope beyond the pilot (decided 2026-08-06): real members,
Aylesbury Berryfields only — not multi-gym yet.

## Stages

1. **Pilot mechanism proof** (Aylesbury Berryfields, single test account) — done 2026-08-05. Proved booking + Kisi unlock work end-to-end before investing in real auth, payments, or multi-gym support.

   **Kisi integration proven live** — unlock confirmed via Kisi's own activity log, not just a `200 OK` (the API accepting a request doesn't guarantee the physical controller executed it — both were checked separately).

   **`supabase/migrations` live in podHq, not here** (shared Supabase project):
   - `0009_pod_booking.sql` — `gym_kisi_mapping`, `members`, `credits` (append-only ledger, not a mutable balance), `bookings` (60-min slots on the hour, partial unique index so cancelling frees the slot), `pod_access_events` (unlock audit trail).
   - `0010_create_booking_function.sql` — `create_booking()` Postgres function: atomic credit-balance check + booking insert + credit deduction in one transaction, so a booking can never exist without its credit being consumed.

   Pilot member: `pilot-member@example.com`, `member_id` 1, Aylesbury Berryfields, created via `create-pilot-member.mjs` in podHq. App routes: `/login`, `/book` (24hr slot grid, credit balance, book + unlock), `/api/auth/login`, `/api/auth/logout`, `/api/bookings`, `/api/unlock`.

   **Booking flow verified end-to-end through the actual UI**: booked the 13:00 and 15:00 slots, credits deducted correctly. A rapid triple-click on Book was checked directly against the database afterward — only one booking and one credit deduction happened, protected by the DB-level unique index + atomic function, not just client-side disabling.

   **Real Kisi unlock fired twice successfully through the app** (confirmed in `pod_access_events`, not just the response code). **Unlock route hardened**: the Kisi call is now wrapped in try/catch so a failure is always logged with the real reason — found the gap when an unlock attempt failed with literally nothing in the audit log to show for it, because an unhandled exception skipped the logging step entirely.

   **Known open items, not yet resolved:**
   - One unlock attempt failed with no log entry (this was *before* the try/catch fix above, so the real cause was never captured). Never reproduced since the pod was occupied both times we could have retried. Try again once clear — if it fails again, `pod_access_events` will now show the actual reason instead of nothing.

   **Resolved 2026-08-06: unlock duration is 15s, not the intended 10s.** Kisi's own activity log for a real test unlock (see below) showed "unlocked" at 4:33:04 PM and "was locked" (auto re-lock) at 4:33:19 PM — 15 seconds, not the 10s the Relays setting was supposedly changed to. Either that change didn't save or something else is overriding it — worth re-checking the Kisi dashboard's Relays setting directly rather than assuming it's still pending.

   **Kisi key rotation verified live 2026-08-06** (see also the Security note below): after rotating `KISI_API_KEY`, ran a full real test through the actual UI — logged in as the pilot member (password reset via a one-off admin script, since it wasn't known), booked the then-current hour slot, clicked the real Unlock button, and cross-checked two independent sources: this app's `pod_access_events` (`success=true`, `kisi_response="200 OK"`, timestamped 16:33:04 local) and Kisi's own activity log pasted directly by the user (unlock at 4:33:04 PM, auto re-lock at 4:33:19 PM) — timestamps agree exactly. Confirms the rotated key works end-to-end, not just that it was pasted into the right place. Noted in passing: Kisi's log attributes the unlock to "Carl Simpson (admin@myfitpod.co.uk)" — the Kisi account that owns the API key — not the actual member who triggered it via the app; `pod_access_events` (`member_id`/`booking_id`) is the real source of truth for per-member attribution, Kisi's own log can't provide that.

2. **Auth hardening** — login lockout + rate-limiting, reusing podHq's already-debugged patterns rather than re-discovering the same bugs (see podHq ROADMAP Stage 2's MFA/hydration/CSP history for what to watch for). **Mandatory MFA deliberately dropped** (decided 2026-08-06): GymFlow itself has no MFA for members, and requiring it on every gym visit would be real friction for a consumer app, unlike podHq's staff/financial-data context where it's justified. Accepted tradeoff: a compromised password alone is enough to book a slot and unlock the door — nothing else stands in the way — so lockout/rate-limiting (blocking brute-force/credential-stuffing, the more realistic threat than a targeted takeover) stays load-bearing here in MFA's absence, not optional.

3. **CSP** — own nonce setup, verified against this app's actual script/style needs rather than a blind copy of podHq's `proxy.ts` (podHq's CSP required real, non-obvious debugging work — see its ROADMAP Stage 2 hardening note for the failure mode to watch for: inline hydration scripts silently blocked with zero console warning).

4. **Stripe integration** — replaces manual credit grants with real payment-driven credit purchases.

5. **Real member onboarding** — replaces the single hand-created pilot account with an actual signup/invite flow.

6. **Deploy to Vercel** — separate deployment from podHq; not yet configured.

## Deliberate pilot-scope simplifications still open (Stages 2-6 above close these)

- Single pod, single gym — no multi-pod capacity logic exists. Out of scope even after Stages 2-6 (target is still Aylesbury-only, not multi-gym) — revisit only if the target scope changes.

## Kisi ↔ gym-name mapping gotcha (see gym_kisi_mapping)

Kisi's place names don't match podHq's `Revenue.gym` strings 1:1. Confirmed
live: Kingston, Basingstoke, Milton Keynes, Berkhamsted, and Aylesbury all
have a Kisi place; Crewe and Hackney do not — confirmed with the business
owner that those two run on a separate access-control system entirely, not
Kisi. Oxford East is also absent from Kisi with no explanation confirmed
yet. One Kisi place, "Thomley," doesn't correspond to any of the 9 gym
names — unresolved, possibly Oxford East under a different name, not
verified.

## Security note — resolved 2026-08-06

A prior session's note here claimed the Kisi API key was accidentally
pasted into chat during this project's setup. The user disputed that this
happened, and no Claude session present for that conversation could
verify it either way — a search of this codebase found no trace of the
actual key value anywhere (only the non-secret `kisi_place_id`/
`kisi_lock_id` numeric IDs are committed, in `0009_pod_booking.sql`).
Regardless of whether the original claim was accurate, the user rotated
the key in the Kisi dashboard and updated `KISI_API_KEY` in `.env.local`
as a precaution (2026-08-06). The rotated key's actual value was never
read here (`.env.local` is hard-blocked, see both projects'
`.claude/settings.json`), but its function was verified live the same
day — see Stage 1's "Kisi key rotation verified live" note above. Fully
closed.
