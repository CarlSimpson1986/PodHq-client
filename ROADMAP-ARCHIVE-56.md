# Archive 56 — Resend-key signup crash (2026-09-02)

Split out 2026-09-03 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, fully resolved
and verified. Reference-only, not `@`-included anywhere.

## Signup crash from an undecryptable gym Resend key — 2026-09-02

**Real production bug, found live**: Carl signed up on `podhq-client.vercel.app`
and got "Something went wrong. Try again." — but the account was actually
created successfully (auth user, `members` row, `leads` row, `auth_events`
row all committed; Supabase's own confirmation email genuinely sent).

Root cause: `/api/auth/signup` creates the member, then tries to email
gym staff (`staffNewSignupEmail`/`notifyFireAndForget`). Hove has a
`gym_resend_config` row, so that path calls `getGymResendConfig('Hove')`,
which calls `decryptSecret()` on the stored API key —
`SECRET_ENCRYPTION_KEY` was never set in **podhq-client's own** Vercel
Production env (confirmed by Carl checking directly; it's a separate
Vercel project from podHq, so podHq having its own copy set doesn't
cover this app — same convention noted in `secret-encryption.ts`'s own
header comment). `decryptSecret` throws when the key's missing, and that
throw was uncaught — propagating out of `sendEmail` (whose own docstring
promises "never throws") through `notifyFireAndForget` and crashing the
whole request *after* the member row had already committed, so the
client got a raw 500 it couldn't parse instead of the app's normal JSON
response. Confirmed via `notification_log`: zero `staff_new_signup` rows
since 2026-08-22 (the last one before this was found), while Hove picked
up 2 new members since then with no notification row for either — this
had been silently breaking every Hove signup's staff notification, and
showing this false error to the member, for over a week.

**Fixed**: `getGymResendConfig` (`resend-config.ts`) now catches the
`decryptSecret` throw the same way it already handled a Supabase query
error — logs it, returns `null`, falls back to the shared Resend
account. A gym's broken/missing encryption key can never crash a
signup (or any other caller of `sendEmail`) again, regardless of the
Vercel env cause. `wearables.ts`'s own `decryptSecret` call sites were
checked too — both already either throw-and-let-the-caller-handle-it
(single-connection lookup, an intentional existing contract) or already
catch-and-skip (the sync cron's batch loop), so left alone.

**Resolved 2026-09-02, Carl (manual, in Vercel — matches how
account-level Vercel/Supabase/Stripe settings get handled on this
project)**: turned out podHq's existing `SECRET_ENCRYPTION_KEY` couldn't
be copied across — Vercel's Sensitive variable type can't be read back
once saved, which is almost certainly what actually caused the original
2026-08-22 Aylesbury incident (a value that could never be verified,
not just a paste slip). Generated a fresh key instead and rotated it
properly: set in both podHq's and podhq-client's Vercel (Production +
Preview), both redeployed, then Hove's Resend API key re-saved through
podHq's `/setup` so its stored ciphertext actually matches the new key.
Full writeup of the parity requirement (and why a value alone can't be
trusted) now lives in CLAUDE.md's own "Deployment" section, not just
here, so it survives this file's own archiving.

**Verified**: `tsc --noEmit`/`eslint` clean. Root cause and impact
confirmed by direct DB inspection (`members`/`leads`/`auth_events`/
`notification_log` for the actual live signup that surfaced this).
Live re-test of the actual fix (a fresh Hove signup, checked against
`notification_log` landing as `sent`) still outstanding as of this
write-up.
