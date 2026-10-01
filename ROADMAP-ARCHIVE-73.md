# PodHQ Client — Roadmap Archive 73

Reference-only, not auto-loaded. Split out of `ROADMAP.md` 2026-10-01 to
keep it within Claude Code's ~15,000-character `@`-import limit. Covers
App Store submission prep for build 11 and emergency contact info (2026-09-14).

## App Store submission prep + emergency contact info — 2026-09-14, same-day follow-up

Walked Carl through App Store Connect's submission checklist for build 11 (Content Rights, Age Ratings, App Privacy, Keywords, Pricing, Category, Build selection) — Apple's own "Unable to Add for Review" list is the authoritative source of what's outstanding, not this file. One mistake mid-session: told Carl the app collects no phone number, missed `mobile_number` (labelled "Mobile" in `profile-view.tsx`, collected via `/access/contact`) — corrected once found.

Also shipped: **emergency contact info** — nullable `emergency_contact_name`/`emergency_contact_phone` on `members` (`podHq/supabase/migrations/0096_member_emergency_contact.sql`, not yet run — apply manually via Supabase's SQL editor), a new editable card on `/profile`, and `/api/member/emergency-contact`. Carl's call, prompted by the app's only emergency mechanism today being the member dialling 999 themselves or pressing the facility's own Emergency Button — neither helps if they can't act. Pure web/DB change, no native rebuild (native shell just loads the live Vercel deployment).
