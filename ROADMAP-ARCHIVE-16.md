# ROADMAP Archive 16 — Fitbit via Google Health API (2026-08-24)

Reference-only, not `@`-included by CLAUDE.md. Split out of `ROADMAP.md`
2026-08-24 (same day, again) once that file exceeded Claude Code's
~15,000-character `@`-import limit once more. This covers the full
Fitbit-via-Google-Health-API thread — the initial scaffolding (connect/
disconnect flow, encryption, OAuth, the daily sync cron), Carl completing
the outstanding Google Cloud checklist and connecting a real account, the
`CRON_SECRET` rotation that came out of testing it, and the member-facing
Refresh button — moved here once it was fully finished and acted upon
(the same "move what's finished, not necessarily what's oldest" logic as
`ROADMAP-ARCHIVE-14.md`/`-15.md`), superseded by the Health Centre work
that builds on top of it in the active `ROADMAP.md`. The wearable
research spike that led into this lives in `ROADMAP-ARCHIVE-15.md`.

## Fitbit-via-Google-Health-API integration scaffolded — 2026-08-24

Built the connect/disconnect flow plus real synced data, replacing the
Profile page's "Health markers" placeholder — scope confirmed with Carl
via Plan Mode: connect + display, not yet wired into AI Coach generation
logic (deliberately deferred). Disconnect deletes all previously-synced
data immediately, not just future syncs.

**Data model** (podHq migration `0057_member_wearable_connections.sql`):
`member_wearable_connections` (one row per member, encrypted refresh
token) and `member_wearable_data` (one row per member per synced day —
steps/sleep/resting heart rate), both modeled on `gym_resend_config`'s
shape (dedicated table, RLS enabled with zero policies, service-role-only
access) rather than a bare column-add.

**Encryption**: reused the existing AES-256-GCM `SECRET_ENCRYPTION_KEY`
pattern rather than inventing a new one — podhq-client previously only
had a decrypt-only copy of `secret-encryption.ts` (for reading podHq-
written gym configs); this needed the full encrypt+decrypt pair since
this app is both writer (OAuth callback) and reader (sync cron) for this
particular secret. `src/lib/data/resend-config.ts`'s own duplicate
`decryptSecret` was consolidated to import the new shared module instead
of keeping two copies.

**OAuth + data fetch**: `google-auth-library`'s `OAuth2Client` (not the
full `googleapis` package), standard authorization-code flow with a
random-value cookie for CSRF protection on the callback (no existing
connect/disconnect-a-third-party pattern existed in this codebase to
reuse — designed fresh). Google Health API's REST shape (base URL,
scopes, `dailyRollUp` endpoint, `dataType` id strings) was verified live
against Google's docs rather than assumed, since this is a brand-new API
(GA'd May 2026) outside training data — the one piece that couldn't be
fully verified without live credentials is the exact JSON response field
names for a rollup call (undocumented publicly), so that one parsing
function is written defensively (never throws on an unexpected shape,
degrades to "no data for that field" instead) and flagged in its own
comment for Carl to confirm against a real response.

**Sync**: new daily Vercel Cron route (`/api/wearables/sync`, 05:00,
after the existing 04:00/09:00 jobs), copying `waitlist/expire`'s exact
`CRON_SECRET` fail-closed pattern verbatim. **Added to `proxy.ts`'s
public-paths list up front** — this exact class of bug (a cron route
silently redirected to `/login` before reaching its own auth check) was
already hit and fixed once before, 2026-08-14, for the win-back route.

**Outstanding before this can be tested end-to-end — all on Carl**:
1. Create a Google Cloud project + OAuth 2.0 client at
   developers.google.com/health/setup. Redirect URI must be HTTPS, so
   testing has to happen against a deployed preview/production URL, not
   local dev.
2. New OAuth clients start **unverified, capped at 100 manually-added
   test users** (added one by one in Cloud Console) until Google
   completes app verification (needs a privacy policy, scope
   justification) — real rollout stays capped at ~100 members until
   that's pursued, same category of gate as the App Store review
   researched earlier today.
3. Add three new env vars to Vercel: `GOOGLE_HEALTH_CLIENT_ID`,
   `GOOGLE_HEALTH_CLIENT_SECRET`, `GOOGLE_HEALTH_REDIRECT_URI`
   (`https://podhq-client.vercel.app/api/wearables/fitbit/callback`).
   `SECRET_ENCRYPTION_KEY`/`CRON_SECRET` already exist (shared with the
   gym-config and other-cron use cases).

**Verified**: `npx tsc --noEmit`, `eslint`, `npx vitest run` (71/71,
including 4 new encryption round-trip tests), `next build` all clean.
The OAuth exchange and REST data-fetch calls themselves aren't
realistically unit-testable without live Google credentials — real
end-to-end verification is blocked on the three items above.

**2026-08-24, later same day**: Carl manually triggered
`/api/wearables/sync` from PowerShell to test the `CRON_SECRET` gate end
to end — a fragment of the secret was pasted into a terminal command
(and briefly surfaced via an editor selection) during that debugging, so
it was rotated in both Vercel and local `.env.local` as a precaution.
Re-tested against the new secret: `status: ok`, confirming the route's
auth check and Vercel Cron wiring both work correctly. `synced: 0` /
`failed: 0` since no member has a wearable connection to sync yet — the
three outstanding Google Cloud items above are still what's blocking
that.

Carl then set up the Google Cloud OAuth client and completed a real
connect flow end-to-end (test user added, unverified-app warning
clicked through, callback landed back on Profile connected) — the
outstanding checklist above is now fully done. First data point still
needs a sync to actually land, since the OAuth callback only saves the
connection and doesn't itself fetch data — realising this, Carl asked
for a member-facing "refresh" button rather than waiting on the nightly
cron, so that was built as the same-day follow-up: **new
`POST /api/wearables/fitbit/refresh` route** (session-authenticated,
scoped to the caller's own connection, 5/min rate limit — distinct from
`/api/wearables/sync`'s CRON_SECRET-gated all-members loop), plus a
**Refresh button** on `WearableConnectionCard`. Reuses the cron's exact
"yesterday, not today" date logic (see that route's comment) — this
button's value is not waiting up to 24h after first connecting, not
intraday freshness. Verified clean: `tsc --noEmit`, `eslint`,
`vitest run` (still 71/71 — no new tests added, this route has no
branchy logic beyond what `/api/wearables/sync` and
`/api/wearables/fitbit/disconnect` already cover the same way).

This was explicitly framed as stage one of two by Carl: he also wants a
unified "Health Centre" — recovery (this wearable data) + nutrition +
training combined into one system feeding AI Coach generation, which
this scaffolding deliberately deferred. That work continues in the
active `ROADMAP.md`'s "Health Centre" section.
