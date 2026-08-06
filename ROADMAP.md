# PodHQ Client — Pod Booking Pilot (Aylesbury)

Status as of 2026-08-05, end of day one. Sibling project to `../podHq` (the
admin/owner analytics app) — this is the member-facing PWA: book a pod
session, unlock the door via Kisi. Reuses podHq's Supabase project (same
`SUPABASE_URL`/keys) and its dark/gold Tailwind theme. Single pilot member
account, single gym (Aylesbury Berryfields), single pod — prove the
mechanism before expanding to real members or other gyms.

## Built and verified today

- **Kisi integration proven live** — unlock confirmed via Kisi's own
  activity log, not just a `200 OK` (the API accepting a request doesn't
  guarantee the physical controller executed it — both were checked
  separately).
- **`supabase/migrations` in podHq** (this project shares that Supabase
  project, so its migrations live there, not here):
  - `0009_pod_booking.sql` — `gym_kisi_mapping`, `members`, `credits`
    (append-only ledger, not a mutable balance), `bookings` (60-min slots
    on the hour, partial unique index so cancelling frees the slot),
    `pod_access_events` (unlock audit trail).
  - `0010_create_booking_function.sql` — `create_booking()` Postgres
    function: atomic credit-balance check + booking insert + credit
    deduction in one transaction, so a booking can never exist without its
    credit being consumed.
- **Pilot member**: `pilot-member@example.com`, `member_id` 1, Aylesbury
  Berryfields, created via `create-pilot-member.mjs` in podHq.
- **App routes**: `/login`, `/book` (24hr slot grid, credit balance, book +
  unlock), `/api/auth/login`, `/api/auth/logout`, `/api/bookings`,
  `/api/unlock`.
- **Booking flow verified end-to-end through the actual UI**: booked the
  13:00 and 15:00 slots, credits deducted correctly. A rapid triple-click
  on Book was checked directly against the database afterward — only one
  booking and one credit deduction happened, protected by the DB-level
  unique index + atomic function, not just client-side disabling.
- **Real Kisi unlock fired twice successfully through the app** (confirmed
  in `pod_access_events`, not just the response code).
- **Unlock route hardened**: the Kisi call is now wrapped in try/catch so
  a failure is always logged with the real reason — found the gap when an
  unlock attempt failed with literally nothing in the audit log to show
  for it, because an unhandled exception skipped the logging step entirely.

## Known open item

- One unlock attempt failed with no log entry (this was *before* the
  try/catch fix above, so the real cause was never captured). Never
  reproduced since the pod was occupied both times we could have retried.
  Try again once clear — if it fails again, `pod_access_events` will now
  show the actual reason instead of nothing.
- Kisi's per-lock "unlock duration" (how long the door stays unlocked
  before re-locking, default 3s, configurable up to 30s in the Kisi
  dashboard under the door's Relays settings) was being changed to 10s —
  confirm it actually got set and saved.

## Deliberate pilot-scope simplifications — revisit before real members

- No MFA, no CAPTCHA, no login lockout (single throwaway test account,
  not real onboarding).
- No CSP configured at all (podHq's own CSP required real, non-obvious
  debugging work — see podHq's ROADMAP.md Stage 2 hardening note — don't
  just copy its nonce setup blind without re-verifying it against this
  app's own script/style needs).
- Credits are manually granted only — no Stripe/payment integration yet.
  That's the explicitly planned next phase after the pilot proves out.
- Single pod, single gym — no multi-pod capacity logic exists.

## Kisi ↔ gym-name mapping gotcha (see gym_kisi_mapping)

Kisi's place names don't match podHq's `Revenue.gym` strings 1:1. Confirmed
live: Kingston, Basingstoke, Milton Keynes, Berkhamsted, and Aylesbury all
have a Kisi place; Crewe and Hackney do not — confirmed with the business
owner that those two run on a separate access-control system entirely, not
Kisi. Oxford East is also absent from Kisi with no explanation confirmed
yet. One Kisi place, "Thomley," doesn't correspond to any of the 9 gym
names — unresolved, possibly Oxford East under a different name, not
verified.

## Security note

The Kisi API key was accidentally pasted into the chat during this
project's setup. Recommend rotating it in the Kisi dashboard (Add API Key,
same steps as the original) before treating this as anything beyond a
pilot.
