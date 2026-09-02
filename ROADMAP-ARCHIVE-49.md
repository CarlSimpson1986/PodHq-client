# Archive 49 — Weekly weigh-in + body measurements (2026-08-30)

Split out 2026-09-02 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## Weekly weigh-in + body measurements — 2026-08-30

Carl asked whether the app tracked body weight over time — it didn't;
`coach_profiles.weight_kg` was a single current value, fully overwritten
on every profile edit with no history. New `member_body_measurements`
table (migration `0075`, podHq, shared DB) — `weight_kg`/`waist_cm`/
`hip_cm`, all nullable, unique on `member_id, recorded_date`. Deliberately
NOT part of `member_wearable_data`: that table is fully deleted the
moment a member disconnects their wearable (right-to-erasure behaviour),
which would silently wipe manually-entered measurements too.

Logged as an optional step in the existing weekly check-in (Carl's
choice — weekly cadence, not an always-available action, matching this
app's existing pattern for reflective data and avoiding encouraging
daily weigh-ins). A logged weight also syncs into
`coach_profiles.weight_kg` via a new targeted partial-update
(`updateProfileWeightKg`) — `nutrition-targets.ts`'s TDEE calculation
already reads that column live on every call, so nutrition targets pick
up a new weigh-in with zero extra wiring. Trend charts (reusing the
existing `HealthTrendLine` component) show on `/coach/profile`, next to
the weight field, one per metric, hidden entirely until that metric has
at least one logged point.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean. Live-verified on the playground member: a
real check-in submission (backdated the previous check-in row 8 days to
force "due" state for testing) with weight logged and waist/hip left
blank — confirmed the `member_body_measurements` row, the
`coach_profiles.weight_kg` sync, the profile form reflecting the new
value, and the weight trend card rendering correctly with waist/hip
cards absent (no data logged for either).

**Not built this stage**: an always-available "log anytime" entry point
outside the weekly check-in; a computed waist-to-hip ratio or any
health-risk interpretation — this is logging + a trend line, not
analysis.
