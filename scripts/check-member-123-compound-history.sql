-- Read-only check (2026-09-08) — retargeted from member 123 (which no
-- longer exists in `members`) to 151 "Dev Test Member" (Hove), the
-- current dedicated dev/test account. Run before writing a
-- decline-detection test seed, to confirm what's already there.

select id, created_at, status, booking_id
from workout_sessions
where member_id = 151
order by created_at desc
limit 20;

select we.id, we.session_id, we.exercise_key, ws.created_at
from workout_exercises we
join workout_sessions ws on ws.id = we.session_id
where ws.member_id = 151
order by ws.created_at desc
limit 40;
