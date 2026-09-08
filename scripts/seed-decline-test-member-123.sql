-- One-off decline-detection test seed (2026-09-08) — retargeted from
-- member 123 (no longer exists in `members`, wiped 2026-08-22) to 151
-- "Dev Test Member" (Hove), the current dedicated dev/test account.
--
-- Uses Seated Row (compound, per exercise-catalog.ts) rather than Barbell
-- Bench Press: member 151 already has 2 REAL appearances of bench press
-- (sessions 83/86, 2026-09-06) and fabricating a 3rd next to real numbers
-- risked a confusing mix. Seated Row has never appeared for this member
-- (confirmed via check-member-123-compound-history.sql 2026-09-08), so
-- these 3 seeded rows become its entire history — no collision possible.
--
-- Same numbers as decline-detection.test.ts's "flags a genuine decline"
-- fixture: 55kg/8reps/rpe4 (newest) -> 58kg/8/4 -> 60kg/8/3 (oldest). The
-- real app should behave exactly like that already-passing test.
--
-- These 3 rows alone are NOT enough to see the banner — the decline check
-- only runs once, at NEW session generation, never retroactively on old
-- sessions. After running this, generate a fresh workout for member 151
-- via the "Build your own" custom builder and pick Seated Row explicitly
-- (the normal AI rotation might pick a different back exercise and never
-- trigger the check at all).
--
-- Idempotent: skips if member 151 already has a Seated Row appearance.
-- Run in Supabase's SQL Editor. To remove afterward:
-- scripts/remove-decline-test-member-123.sql

do $$
declare
  v_member_id constant bigint := 151;
  v_has_seed boolean;
  v_session_id bigint;
  v_exercise_id bigint;
begin
  select exists(
    select 1 from workout_exercises we
    join workout_sessions ws on ws.id = we.session_id
    where ws.member_id = v_member_id and we.exercise_key = 'seated_row'
  ) into v_has_seed;

  if v_has_seed then
    raise notice 'seated_row already exists for member % — skipped', v_member_id;
    return;
  end if;

  -- Oldest of the 3 appearances: 60kg x 8, RPE 3.
  insert into workout_sessions (member_id, booking_id, resource_id, status, created_at)
  values (v_member_id, null, null, 'completed', now() - interval '3 days')
  returning id into v_session_id;
  insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
  values (v_session_id, 'seated_row', 'Seated Row', 'back', 0)
  returning id into v_exercise_id;
  insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
    (v_exercise_id, 1, 8, 60, 8, 60, null, now() - interval '3 days'),
    (v_exercise_id, 2, 8, 60, 8, 60, null, now() - interval '3 days'),
    (v_exercise_id, 3, 8, 60, 8, 60, 3, now() - interval '3 days');

  -- Middle appearance: 58kg x 8, RPE 4.
  insert into workout_sessions (member_id, booking_id, resource_id, status, created_at)
  values (v_member_id, null, null, 'completed', now() - interval '2 days')
  returning id into v_session_id;
  insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
  values (v_session_id, 'seated_row', 'Seated Row', 'back', 0)
  returning id into v_exercise_id;
  insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
    (v_exercise_id, 1, 8, 58, 8, 58, null, now() - interval '2 days'),
    (v_exercise_id, 2, 8, 58, 8, 58, null, now() - interval '2 days'),
    (v_exercise_id, 3, 8, 58, 8, 58, 4, now() - interval '2 days');

  -- Newest appearance: 55kg x 8, RPE 4 (not lower than the RPE from 2
  -- appearances ago -- 3 -- so it correctly does NOT read as a deliberate
  -- back-off).
  insert into workout_sessions (member_id, booking_id, resource_id, status, created_at)
  values (v_member_id, null, null, 'completed', now() - interval '1 day')
  returning id into v_session_id;
  insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
  values (v_session_id, 'seated_row', 'Seated Row', 'back', 0)
  returning id into v_exercise_id;
  insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
    (v_exercise_id, 1, 8, 55, 8, 55, null, now() - interval '1 day'),
    (v_exercise_id, 2, 8, 55, 8, 55, null, now() - interval '1 day'),
    (v_exercise_id, 3, 8, 55, 8, 55, 4, now() - interval '1 day');

  raise notice 'decline-test seed inserted for member % (3 sessions, Seated Row declining)', v_member_id;
end $$;
