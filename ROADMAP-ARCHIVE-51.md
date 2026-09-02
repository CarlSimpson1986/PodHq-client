# Archive 51 — Cardio equipment logging (2026-08-30)

Split out 2026-09-02 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## Cardio equipment logging — 2026-08-30

Scoped 2026-08-29, never built until Carl asked "cardio wise — I can add
that via the UI right?" — confirmed nothing existed on either side.
Gym staff name individual machines on podHq's `/setup` (new
`gym_cardio_equipment` table, `0076` shared DB, owner-editable with
admin fallback, mirrors the pricing catalog's exact pattern —
soft-disable not delete, so history stays meaningful). Members log which
one they used as a 5th row on Today's Mission ("2/5 today" →
"3/5 today" etc.), tapping through to `/cardio-log`, a plain named-button
list; `member_cardio_logs` is insert-only, same convention `habit_logs`
already established (no stateful "completed" flag, "done today" is
`count(*) > 0`). Binary log only, no duration/distance this stage —
matches Carl's own framing ("counts toward missions"), not a fitness
tracker.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (172/172), and
`npm run build` all clean in both repos. Live-verified end to end on the
Aylesbury Berryfields gym: added Treadmill 1 + Rower 1 on `/setup`,
disabled Treadmill 1, confirmed podhq-client's picker showed only Rower
1; logged it, confirmed the Today's Mission Cardio row flipped to
"Logged" and the `member_cardio_logs` row matched exactly. Hit and
resolved an incidental blocker: the playground member's browser session
had expired mid-test with no stored password — reset it via the same
service-role script pattern podHq already has for its own pilot account.

**Not built this stage**: duration/distance tracking; cross-gym equipment
visibility for members training at a different network gym; equipment
type/category taxonomy.
