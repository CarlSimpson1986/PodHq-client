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
`ROADMAP-ARCHIVE.md` through `ROADMAP-ARCHIVE-15.md`, covering the pilot
mechanism proof (2026-08-05) through the full wearable-integration
research thread (2026-08-24) — all split out to keep this file within
Claude Code's ~15,000-character `@`-import limit. Archives aren't always
the strictly oldest material — the split point is "what's finished and
stable" as much as "what's oldest" (see `ROADMAP-ARCHIVE-14.md`'s and
`-15.md`'s own header notes for two same-day examples of this). All
archives are reference-only (not auto-loaded by CLAUDE.md); check them
for full stage-by-stage build history, or `git log` on this file for the
exact split points. This file's active content is the Fitbit-via-Google-
Health-API scaffolding (2026-08-24, blocked on Carl's Google Cloud setup
— see that section for the outstanding checklist) plus whatever's added
after it. If this file grows too large again, split it the same way:
move whichever section is most clearly finished (not necessarily the
chronologically oldest) into a numbered `ROADMAP-ARCHIVE-16.md`, leave a
pointer note at the top of this file, and update this paragraph.

## Wearable integration research — Google Health API note — 2026-08-24

Full detail moved to `ROADMAP-ARCHIVE-15.md` the same day, once its
conclusions were stable and acted upon. Summary: Fitbit's legacy API
dies September 2026 — target the **Google Health API** instead (GA'd
May 2026, self-serve). Apple HealthKit has zero cloud API by design
(native app + App Store required, no workaround); Android's Health
Connect is on-device only and only matters for a wearable with no cloud
API of its own. Checked live, by brand: **Garmin** — developer program
closed to new sign-ups, not currently buildable. **Whoop**/**Oura** —
both self-serve like Fitbit (Oura has a real caveat: needs the member's
own paid Oura Membership, not just a ring). **Samsung** — feeds Android's
Health Connect, not the cloud Google Health API; same native-only bucket
as Apple, despite both being "Google." Full App-Store-pre-emption
research (timelines, common HealthKit rejection reasons, the Guideline
3.1.3 payment exemption) also lives in the archive.

## Fitbit-via-Google-Health-API integration scaffolded — 2026-08-24 (same day)

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
