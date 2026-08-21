@AGENTS.md
@ROADMAP.md

# PodHQ Client — Project Rules

## What this is
Member-facing PWA: book a pod session, unlock the door via Kisi. Sibling
project to `../podHq` (staff/admin analytics) — shares its Supabase project
(same `SUPABASE_URL`/keys) and its dark/gold Tailwind theme, but is a fully
separate Next.js app with its own repo and its own deploy. See ROADMAP.md
for build status; see podHq's CLAUDE.md/ROADMAP.md for the wider gym-name
list and its own tables (`Revenue`/`attendance`/`users_gyms` etc.) if
working across both apps in the same session.

## Stack
- Next.js 16+ (App Router, TypeScript, Tailwind CSS v4)
- Supabase (Postgres, Auth, RLS) — same project as podHQ, this app's tables
  live in podHQ's `supabase/migrations/` (`0009_pod_booking.sql`,
  `0010_create_booking_function.sql`), not duplicated here
- Kisi API for physical door unlock
- Deployed on Vercel (not yet deployed — see ROADMAP)

## Session handoff
- Before any `git commit`/`git push` that wraps up a working session, add a
  short summary of that session to `ROADMAP.md` (matching its existing
  per-stage style: what changed, why, and what's verified vs. still
  outstanding) — so the next session opens with full context on where things
  left off, without needing to reconstruct it from the diff or chat history.
- Keep it proportionate: a small fix can be a sentence or two appended to the
  relevant stage; a new feature gets its own stage entry as usual.
- `ROADMAP.md` is `@`-included here, so it loads into every session's
  context automatically — keep it under Claude Code's ~15,000-character
  import limit. Older history lives in two reference-only archives, read
  on demand and deliberately **not** `@`-included: `ROADMAP-ARCHIVE.md`
  (Stages 1-9, 2026-08-05 → 2026-08-15, split out 2026-08-19) and
  `ROADMAP-ARCHIVE-2.md` (2026-08-16 OWASP audit → 2026-08-19 Wellness/
  Recovery Room slot-duration fix, split out 2026-08-21 once the main file
  hit 60KB). If `ROADMAP.md` grows too large again, split it the same way:
  move the oldest dated entries out to a new numbered file
  (`ROADMAP-ARCHIVE-3.md`, etc.), leave a pointer note at the top of
  `ROADMAP.md`, and update this paragraph.

## Conventions
- All components: functional, TypeScript, named exports
- File naming: kebab-case for files, PascalCase for components
- API routes: all in `/app/api/`, server-side only, validate session on every route
- Supabase: verify the session with the caller's own client first, then
  query via `createAdminClient()` — never rely on RLS's `auth.uid()` as the
  actual authorization check (documented token-refresh timing gap in
  podHq's CLAUDE.md applies here too)
- Middleware lives in `src/proxy.ts`, not `middleware.ts` — Next 16's
  renamed convention; `middleware.ts` still works but is deprecated
- Styling: Tailwind only, dark-only theme (no light mode), matches podHq's
  `--accent`/`.card-glass` tokens in `globals.css`
- Currency: GBP (£), 2 decimal places, thousands separator
- British English in all UI copy

## Security Rules (NON-NEGOTIABLE)
- NEVER read, display, log, or reference the contents of `.env.local` or any `.env*` file
- NEVER hardcode API keys, secrets, or credentials anywhere in the codebase —
  `KISI_API_KEY` included, always via `process.env`, never inline
- The Kisi API key controls a physical door lock — treat it with the same
  care as a payment credential; rotate immediately on any suspected exposure
- All Supabase calls go through API routes — no client-side Supabase queries in production
- All API routes must validate the user session before returning data
- RLS must be enabled on every table with data

## Code Quality
- No `any` types — use proper TypeScript interfaces
- All API responses typed
- Error boundaries on every page
- Loading states on every data fetch
- No `console.log` in production code — use proper error logging
