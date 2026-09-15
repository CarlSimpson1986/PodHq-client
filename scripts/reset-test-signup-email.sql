-- Fully wipes a test email so it can be reused for a genuinely fresh
-- signup (2026-09-15, Carl: deleting the `members` row alone doesn't
-- free the email up — auth.users has no ON DELETE on members.auth_user_id,
-- so a repeat signup for the same email hits signup/route.ts's "existing
-- user" branch and sends a sign-in link instead of ever creating a new
-- member). Run manually via Supabase's SQL editor (same convention as
-- this project's other manual-apply scripts).
--
-- Deletes every row referencing this member across ALL tables with a
-- member_id-shaped foreign key, found dynamically via information_schema
-- rather than a hardcoded table list — this schema gains a new
-- member_id-referencing table every few weeks (credits, bookings,
-- workout_sessions, coach_conversations, daily_habits, ... 20+ already),
-- and a hardcoded list here would silently go stale the next time one's
-- added. Covers gift_vouchers' purchaser_member_id/redeemed_by_member_id
-- too, via the `like '%_member_id'` match.
--
-- session_replication_role is dropped to 'replica' for the actual deletes
-- (reset in an exception handler so it can never get stuck off) rather
-- than relying on deleting tables in exactly the right dependency order —
-- some child rows are one level further removed (e.g. workout_sessions
-- has both member_id AND its own booking_id pointing at a booking this
-- same run deletes; information_schema's row order isn't guaranteed to
-- clear workout_sessions before bookings), and a stray FK violation here
-- would leave the wipe half-done.
--
-- DANGER: hard, irreversible delete. Only ever point this at a throwaway
-- test email, never a real member's — there is no confirmation step.

do $$
declare
  v_email text := 'REPLACE_WITH_TEST_EMAIL';
  v_auth_id uuid;
  v_member_id bigint;
  r record;
begin
  select id into v_auth_id from auth.users where email = v_email;
  if v_auth_id is null then
    raise notice 'No auth user found for %, nothing to wipe.', v_email;
    return;
  end if;

  select id into v_member_id from public.members where auth_user_id = v_auth_id;

  begin
    set local session_replication_role = replica;

    if v_member_id is not null then
      for r in
        select table_schema, table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and (column_name = 'member_id' or column_name like '%\_member\_id')
      loop
        execute format('delete from %I.%I where %I = $1', r.table_schema, r.table_name, r.column_name)
          using v_member_id;
      end loop;

      delete from public.members where id = v_member_id;
    end if;

    delete from auth.users where id = v_auth_id;

    set local session_replication_role = default;
  exception when others then
    set local session_replication_role = default;
    raise;
  end;

  raise notice 'Wiped auth user % (member id %) for %', v_auth_id, v_member_id, v_email;
end $$;
