-- Removes everything created while testing decline-detection against
-- member 151 "Dev Test Member" (2026-09-08): the 3 seeded fake Seated Row
-- appearances (scripts/seed-decline-test-member-123.sql), the one real
-- session it produced (session id 94, booking id 180 -- confirmed via the
-- app's own API during testing, not guessed), and the test booking/credit
-- that session needed to exist at all.

-- The 3 seeded historical Seated Row appearances.
delete from workout_sets using workout_exercises, workout_sessions
  where workout_sets.exercise_id = workout_exercises.id
  and workout_exercises.session_id = workout_sessions.id
  and workout_sessions.member_id = 151
  and workout_exercises.exercise_key = 'seated_row'
  and workout_sessions.created_at between now() - interval '4 days' and now() - interval '12 hours';

delete from workout_exercises using workout_sessions
  where workout_exercises.session_id = workout_sessions.id
  and workout_sessions.member_id = 151
  and workout_exercises.exercise_key = 'seated_row'
  and workout_sessions.created_at between now() - interval '4 days' and now() - interval '12 hours';

delete from workout_sessions where member_id = 151
  and booking_id is null
  and created_at between now() - interval '4 days' and now() - interval '12 hours';

-- The one real session (94) generated while testing the banner.
delete from workout_sets where exercise_id in (
  select id from workout_exercises where session_id = 94
);
delete from workout_exercises where session_id = 94;
delete from workout_sessions where id = 94;

-- The test booking (180, today 10:00) that session needed to exist, and
-- BOTH credit ledger rows it produced -- the manual_grant (+1,
-- scripts/grant-test-credit-member-151.sql) and the booking_used (-1) it
-- was spent on. Deleting only one would leave the ledger net -1 or +1
-- instead of back to zero.
delete from bookings where id = 180 and member_id = 151;
delete from credits where member_id = 151 and (
  (reason = 'manual_grant' and amount = 1) or booking_id = 180
);
