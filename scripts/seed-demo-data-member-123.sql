-- One-off demo-data seed for member 123 ("carl simpson", Aylesbury
-- Berryfields, owner-test@example.com) — requested by Carl 2026-08-25
-- so the redesigned Dashboard/Training/Nutrition/Health tabs have
-- something real to look at instead of every section showing its
-- empty state. Run once against the live Supabase project (SQL Editor,
-- or `psql`/the Supabase CLI) — not a schema migration, so it does NOT
-- belong in podHq's supabase/migrations/ folder; kept here in
-- podhq-client instead, reviewable and disposable.
--
-- Idempotent: each section checks whether matching rows already exist
-- and skips itself if so — safe to re-run without duplicating data.
-- Never fabricates sleep data (still genuinely unavailable — see
-- google-health.ts) and only seeds wearable snapshots if member 123
-- already has a real wearable connection (doesn't fabricate an OAuth
-- connection/token).
--
-- To remove this data later:
--   delete from workout_sets using workout_exercises, workout_sessions
--     where workout_sets.exercise_id = workout_exercises.id
--     and workout_exercises.session_id = workout_sessions.id
--     and workout_sessions.member_id = 123 and workout_sessions.booking_id is null
--     and workout_sessions.created_at between '2026-07-13' and '2026-08-25';
--   delete from workout_exercises using workout_sessions
--     where workout_exercises.session_id = workout_sessions.id
--     and workout_sessions.member_id = 123 and workout_sessions.booking_id is null
--     and workout_sessions.created_at between '2026-07-13' and '2026-08-25';
--   delete from workout_sessions where member_id = 123 and booking_id is null
--     and created_at between '2026-07-13' and '2026-08-25';
--   delete from food_log_entries where member_id = 123
--     and logged_date between '2026-08-19' and '2026-08-24' and source = 'manual';
--   delete from member_wearable_data where member_id = 123
--     and recorded_date between '2026-08-13' and '2026-08-25';

do $$
declare
  v_member_id constant bigint := 123;
  v_has_connection boolean;
  v_has_blocks boolean;
  v_has_sessions boolean;
  v_has_food boolean;
  v_session_id bigint;
  v_exercise_id bigint;
  v_date date;
  v_type text;
  v_i int;
  v_upper_idx int := 0;
  v_lower_idx int := 0;
  v_dates date[] := array[
    '2026-07-13','2026-07-16','2026-07-20','2026-07-23','2026-07-27','2026-07-30',
    '2026-08-03','2026-08-06','2026-08-10','2026-08-13','2026-08-17','2026-08-20','2026-08-24'
  ]::date[];
  v_types text[] := array['A','B','A','B','A','B','A','B','A','B','A','B','A'];
  -- Progression indexed 1..7 (upper/'A' sessions) / 1..6 (lower/'B' sessions).
  v_bench numeric[] := array[45,47.5,50,50,52.5,55,57.5];
  v_lat numeric[] := array[40,42.5,42.5,45,47.5,47.5,50];
  v_shoulder numeric[] := array[12,12,14,14,14,16,16];
  v_squat numeric[] := array[60,62.5,65,65,67.5,70];
  v_rdl numeric[] := array[50,52.5,52.5,55,57.5,60];
  v_legext numeric[] := array[30,32.5,35,35,37.5,40];
  v_weight numeric;
  v_prev numeric;
  v_rpe smallint;
  v_reps smallint;
begin
  -- 1. Wearable snapshots — only if a real connection already exists.
  -- sleep_minutes stays null throughout: real sleep data genuinely isn't
  -- available yet (Google Health's dailyRollUp has no sleep field), so
  -- this seed doesn't fabricate it either.
  select exists(select 1 from member_wearable_connections where member_id = v_member_id) into v_has_connection;
  if v_has_connection then
    insert into member_wearable_data (member_id, recorded_date, steps, sleep_minutes, resting_heart_rate, hrv_ms, synced_at)
    select v_member_id, d, s, null, r, h, now()
    from unnest(
      array['2026-08-13','2026-08-14','2026-08-15','2026-08-16','2026-08-17','2026-08-18','2026-08-19',
            '2026-08-20','2026-08-21','2026-08-22','2026-08-23','2026-08-24','2026-08-25']::date[],
      array[8200,9100,7600,10200,6800,9400,8900,7100,9800,8500,7900,9200,8600],
      array[58,57,59,56,60,57,58,59,56,57,58,57,56],
      array[52,55,48,58,45,53,54,47,56,51,49,55,53]
    ) as t(d, s, r, h)
    on conflict (member_id, recorded_date) do update
      set steps = excluded.steps, resting_heart_rate = excluded.resting_heart_rate,
          hrv_ms = excluded.hrv_ms, synced_at = excluded.synced_at;
    raise notice 'wearable data upserted';
  else
    raise notice 'no wearable connection for member % — skipped wearable seed', v_member_id;
  end if;

  -- 2. Training block (implicit Block 1 already works without this — only
  -- adds one if there's genuinely no history yet).
  select exists(select 1 from training_blocks where member_id = v_member_id) into v_has_blocks;
  if not v_has_blocks then
    insert into training_blocks (member_id, block_type, started_at) values (v_member_id, 'hypertrophy', now() - interval '45 days');
    raise notice 'training block inserted';
  else
    raise notice 'training block already exists — skipped';
  end if;

  -- 3. Workout sessions — 13 sessions over 6 weeks, alternating upper/
  -- lower, with real progression per exercise and a per-exercise RPE
  -- recorded once on the final set (matches getWorkoutHistory's own
  -- "RPE only ever recorded on the last set" convention).
  select exists(
    select 1 from workout_sessions
    where member_id = v_member_id and booking_id is null
      and created_at between '2026-07-13T00:00:00Z' and '2026-08-25T00:00:00Z'
  ) into v_has_sessions;

  if not v_has_sessions then
    for v_i in 1..array_length(v_dates, 1) loop
      v_date := v_dates[v_i];
      v_type := v_types[v_i];

      insert into workout_sessions (member_id, booking_id, resource_id, status, created_at)
      values (v_member_id, null, null, 'completed', v_date + interval '18 hours')
      returning id into v_session_id;

      if v_type = 'A' then
        v_upper_idx := v_upper_idx + 1;

        insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
        values (v_session_id, 'barbell_bench_press', 'Barbell Bench Press', 'chest', 0) returning id into v_exercise_id;
        v_weight := v_bench[v_upper_idx];
        v_prev := case when v_upper_idx > 1 then v_bench[v_upper_idx - 1] end;
        v_rpe := case when v_prev is not null and v_weight > v_prev then 4 else 2 end;
        v_reps := case when v_rpe = 4 then 7 else 8 end;
        insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
          (v_exercise_id, 1, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 2, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 3, 8, v_weight, v_reps, v_weight, v_rpe, v_date + interval '18 hours');

        insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
        values (v_session_id, 'lat_pulldown', 'Lat Pulldown', 'back', 1) returning id into v_exercise_id;
        v_weight := v_lat[v_upper_idx];
        v_prev := case when v_upper_idx > 1 then v_lat[v_upper_idx - 1] end;
        v_rpe := case when v_prev is not null and v_weight > v_prev then 4 else 3 end;
        v_reps := case when v_rpe = 4 then 7 else 8 end;
        insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
          (v_exercise_id, 1, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 2, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 3, 8, v_weight, v_reps, v_weight, v_rpe, v_date + interval '18 hours');

        insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
        values (v_session_id, 'dumbbell_shoulder_press', 'Dumbbell Shoulder Press', 'shoulders', 2) returning id into v_exercise_id;
        v_weight := v_shoulder[v_upper_idx];
        v_prev := case when v_upper_idx > 1 then v_shoulder[v_upper_idx - 1] end;
        v_rpe := case when v_prev is not null and v_weight > v_prev then 4 else 2 end;
        v_reps := case when v_rpe = 4 then 7 else 8 end;
        insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
          (v_exercise_id, 1, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 2, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 3, 8, v_weight, v_reps, v_weight, v_rpe, v_date + interval '18 hours');

      else
        v_lower_idx := v_lower_idx + 1;

        insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
        values (v_session_id, 'barbell_squat', 'Barbell Squat', 'legs', 0) returning id into v_exercise_id;
        v_weight := v_squat[v_lower_idx];
        v_prev := case when v_lower_idx > 1 then v_squat[v_lower_idx - 1] end;
        v_rpe := case when v_prev is not null and v_weight > v_prev then 4 else 3 end;
        v_reps := case when v_rpe = 4 then 7 else 8 end;
        insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
          (v_exercise_id, 1, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 2, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 3, 8, v_weight, v_reps, v_weight, v_rpe, v_date + interval '18 hours');

        insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
        values (v_session_id, 'romanian_deadlift', 'Romanian Deadlift', 'legs', 1) returning id into v_exercise_id;
        v_weight := v_rdl[v_lower_idx];
        v_prev := case when v_lower_idx > 1 then v_rdl[v_lower_idx - 1] end;
        v_rpe := case when v_prev is not null and v_weight > v_prev then 4 else 2 end;
        v_reps := case when v_rpe = 4 then 7 else 8 end;
        insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
          (v_exercise_id, 1, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 2, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 3, 8, v_weight, v_reps, v_weight, v_rpe, v_date + interval '18 hours');

        insert into workout_exercises (session_id, exercise_key, name, muscle_group, sort_order)
        values (v_session_id, 'leg_extension', 'Leg Extension', 'legs', 2) returning id into v_exercise_id;
        v_weight := v_legext[v_lower_idx];
        v_prev := case when v_lower_idx > 1 then v_legext[v_lower_idx - 1] end;
        v_rpe := case when v_prev is not null and v_weight > v_prev then 4 else 3 end;
        v_reps := case when v_rpe = 4 then 7 else 8 end;
        insert into workout_sets (exercise_id, set_number, reps_target, weight_target_kg, reps_actual, weight_actual_kg, rpe, completed_at) values
          (v_exercise_id, 1, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 2, 8, v_weight, 8, v_weight, null, v_date + interval '18 hours'),
          (v_exercise_id, 3, 8, v_weight, v_reps, v_weight, v_rpe, v_date + interval '18 hours');
      end if;
    end loop;
    raise notice 'workout sessions/exercises/sets seeded (13 sessions)';
  else
    raise notice 'workout sessions already seeded — skipped';
  end if;

  -- 4. Food log — 6 days of realistic meals (2026-08-19 to 2026-08-24),
  -- deliberately leaving today (2026-08-25) empty so Carl's own logging
  -- shows up cleanly rather than being mixed with seed data.
  select exists(
    select 1 from food_log_entries where member_id = v_member_id
      and logged_date between '2026-08-19' and '2026-08-24'
  ) into v_has_food;

  if not v_has_food then
    insert into food_log_entries (member_id, logged_date, meal, food_name, brand, quantity_g, calories, protein_g, carbs_g, fat_g, source)
    select v_member_id, d, meals.meal, meals.food_name, null, meals.quantity_g, meals.calories, meals.protein_g, meals.carbs_g, meals.fat_g, 'manual'
    from unnest(array['2026-08-19','2026-08-20','2026-08-21','2026-08-22','2026-08-23','2026-08-24']::date[]) as d
    cross join (
      values
        ('breakfast', 'Porridge oats (made with water)', 250::numeric, 175::numeric, 6::numeric, 30::numeric, 3.5::numeric),
        ('breakfast', 'Banana', 120, 107, 1.3, 25, 0.4),
        ('lunch', 'Chicken breast, grilled', 180, 297, 56, 0, 6.5),
        ('lunch', 'Basmati rice, boiled', 200, 260, 5.4, 56, 0.6),
        ('lunch', 'Broccoli, steamed', 100, 34, 2.8, 4, 0.6),
        ('dinner', 'Salmon fillet, baked', 170, 354, 34, 0, 23),
        ('dinner', 'Sweet potato, roasted', 200, 180, 3.2, 41, 0.3),
        ('snacks', 'Greek yoghurt, plain', 170, 105, 17, 6, 0.5),
        ('snacks', 'Mixed nuts', 30, 180, 5.5, 5, 16)
    ) as meals(meal, food_name, quantity_g, calories, protein_g, carbs_g, fat_g);
    raise notice 'food log seeded (6 days)';
  else
    raise notice 'food log already seeded — skipped';
  end if;
end $$;
