-- One-off test credit (2026-09-08) — member 151 "Dev Test Member" has 0
-- credits, blocking a fresh booking needed to trigger a NEW workout
-- generation against the seeded decline-detection history (the check only
-- runs at generation time, never retroactively). Same 'manual_grant'
-- reason/pattern used for member 150 during the 2026-09-05 wargaming
-- session -- credits is an append-only ledger (0009_pod_booking.sql), not
-- a mutable balance column.

insert into public.credits (member_id, amount, reason)
values (151, 1, 'manual_grant');
