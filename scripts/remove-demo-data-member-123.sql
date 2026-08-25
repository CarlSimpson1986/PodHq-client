-- Removes the demo data seeded by scripts/seed-demo-data-member-123.sql
-- (2026-08-25) — Carl's call once real data started mixing with it in
-- the leaderboard ("fuck i forgot seed data").
--
-- member_wearable_data is deliberately scoped to 2026-08-13..2026-08-24,
-- NOT through 2026-08-25 — today's row got overwritten by a real Fitbit
-- sync after the seed ran (confirmed via synced_at: every other day
-- carries the original seed batch's timestamp, today's carries a later
-- one), so it's real data now and must not be deleted.
--
-- food_log_entries is scoped to 2026-08-19..2026-08-24 and source =
-- 'manual' — the same range/source the seed script used, deliberately
-- leaving today's diary alone (it always was, so Carl's own logging
-- shows up clean regardless).

delete from workout_sets using workout_exercises, workout_sessions
  where workout_sets.exercise_id = workout_exercises.id
  and workout_exercises.session_id = workout_sessions.id
  and workout_sessions.member_id = 123 and workout_sessions.booking_id is null
  and workout_sessions.created_at between '2026-07-13' and '2026-08-25';

delete from workout_exercises using workout_sessions
  where workout_exercises.session_id = workout_sessions.id
  and workout_sessions.member_id = 123 and workout_sessions.booking_id is null
  and workout_sessions.created_at between '2026-07-13' and '2026-08-25';

delete from workout_sessions where member_id = 123 and booking_id is null
  and created_at between '2026-07-13' and '2026-08-25';

delete from food_log_entries where member_id = 123
  and logged_date between '2026-08-19' and '2026-08-24' and source = 'manual';

delete from member_wearable_data where member_id = 123
  and recorded_date between '2026-08-13' and '2026-08-24';

-- training_blocks row is left in place deliberately — it's a real
-- statement of fact (member 123 is in a hypertrophy block), not
-- fabricated activity data, and nothing else depends on removing it.
