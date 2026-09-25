-- Phase 1 RLS test. Runs against the hosted DB without Docker:
--   npx supabase db query --linked -f supabase/tests/rls_phase1.sql
-- Everything runs in one transaction that is rolled back, so no data persists.
-- Any failed check raises an exception ("FAIL: ...") and aborts the run.

begin;

-- Two fake users; the signup trigger gives each a profile, a crew, and a template.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.local',
   '{"display_name": "Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.local',
   '{"display_name": "Bob"}', 'authenticated', 'authenticated');

select set_config('test.user_a', '00000000-0000-4000-8000-00000000000a', true),
       set_config('test.user_b', '00000000-0000-4000-8000-00000000000b', true),
       set_config('test.crew_a', (select crew_id::text from public.crew_members
         where user_id = '00000000-0000-4000-8000-00000000000a'), true),
       set_config('test.crew_b', (select crew_id::text from public.crew_members
         where user_id = '00000000-0000-4000-8000-00000000000b'), true);

do $$
begin
  if current_setting('test.crew_a', true) is null or current_setting('test.crew_b', true) is null then
    raise exception 'FAIL: signup trigger did not create default crews';
  end if;
  if (select count(*) from public.checklist_template_items i
      join public.checklist_templates t on t.id = i.template_id
      where t.crew_id = current_setting('test.crew_a')::uuid and t.name = 'Day hike') <> 18 then
    raise exception 'FAIL: Day hike template not seeded for new crew';
  end if;
end $$;

------------------------------------------------------------------------
-- Act as Alice: create a trip and its checklist
------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;

insert into public.trips (crew_id, name, trip_date, trailhead_lat, trailhead_lng)
values (current_setting('test.crew_a')::uuid, 'RLS test hike', current_date + 1, 39.64, -105.19);

select set_config('test.trip_a', (select id::text from public.trips where name = 'RLS test hike'), true);

select count(*) from public.apply_checklist_template(
  current_setting('test.trip_a')::uuid,
  (select id from public.checklist_templates
   where crew_id = current_setting('test.crew_a')::uuid and name = 'Day hike'));

do $$
begin
  if (select count(*) from public.checklist_items
      where trip_id = current_setting('test.trip_a')::uuid) <> 18 then
    raise exception 'FAIL: apply_checklist_template did not copy 18 items';
  end if;
  if (select created_by::text from public.trips
      where id = current_setting('test.trip_a')::uuid) <> current_setting('test.user_a') then
    raise exception 'FAIL: trips.created_by not defaulted to auth.uid()';
  end if;
end $$;

update public.checklist_items set checked = true
where id = (select id from public.checklist_items
            where trip_id = current_setting('test.trip_a')::uuid order by sort limit 1);

do $$
begin
  if not exists (select 1 from public.checklist_items
                 where trip_id = current_setting('test.trip_a')::uuid
                   and checked and checked_by::text = current_setting('test.user_a')
                   and checked_at is not null) then
    raise exception 'FAIL: checked_by/checked_at not set by trigger';
  end if;
end $$;

insert into public.crew_invites (crew_id) values (current_setting('test.crew_a')::uuid);
select set_config('test.invite_code', (select code from public.crew_invites
  where crew_id = current_setting('test.crew_a')::uuid limit 1), true);

reset role;

------------------------------------------------------------------------
-- Act as Bob (not a member of Alice's crew): must see and change nothing
------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  n int;
begin
  if (select count(*) from public.trips) <> 0 then
    raise exception 'FAIL: non-member can read a trip';
  end if;
  if (select count(*) from public.checklist_items) <> 0 then
    raise exception 'FAIL: non-member can read checklist items';
  end if;
  if (select count(*) from public.crew_invites) <> 0 then
    raise exception 'FAIL: non-member can read invites';
  end if;
  if exists (select 1 from public.profiles where id::text = current_setting('test.user_a')) then
    raise exception 'FAIL: non-member can read a stranger''s profile';
  end if;
  if exists (select 1 from public.crews where id = current_setting('test.crew_a')::uuid) then
    raise exception 'FAIL: non-member can read another crew';
  end if;

  update public.trips set name = 'hijacked' where id = current_setting('test.trip_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-member updated a trip'; end if;

  delete from public.checklist_items where trip_id = current_setting('test.trip_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-member deleted checklist items'; end if;

  begin
    insert into public.trips (crew_id, name) values (current_setting('test.crew_a')::uuid, 'sneaky');
    raise exception 'FAIL: non-member inserted a trip into another crew';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.crew_members (crew_id, user_id)
    values (current_setting('test.crew_a')::uuid, current_setting('test.user_b')::uuid);
    raise exception 'FAIL: user added themselves to a crew directly';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.redeem_crew_invite('NOTACODE');
    raise exception 'FAIL: bogus invite code was accepted';
  exception when no_data_found then null;
  end;
end $$;

------------------------------------------------------------------------
-- Bob redeems Alice's invite: now sees the trip, and his empty crew is gone
------------------------------------------------------------------------
select public.redeem_crew_invite(lower(current_setting('test.invite_code')));

do $$
begin
  if (select count(*) from public.trips where id = current_setting('test.trip_a')::uuid) <> 1 then
    raise exception 'FAIL: member cannot read crew trip after redeeming';
  end if;
  if not exists (select 1 from public.profiles where id::text = current_setting('test.user_a')) then
    raise exception 'FAIL: crewmate profile not visible';
  end if;
  if (select count(*) from public.crew_members where crew_id = current_setting('test.crew_a')::uuid) <> 2 then
    raise exception 'FAIL: crew should have 2 members';
  end if;
  -- Redeeming again as an existing member is a no-op success
  if public.redeem_crew_invite(current_setting('test.invite_code')) <> current_setting('test.crew_a')::uuid then
    raise exception 'FAIL: re-redeem by member should return the crew';
  end if;
  -- Clients cannot spoof checked_by
  begin
    update public.checklist_items set checked_by = current_setting('test.user_a')::uuid
    where trip_id = current_setting('test.trip_a')::uuid;
    raise exception 'FAIL: client could write checked_by';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

do $$
begin
  if exists (select 1 from public.crews where id = current_setting('test.crew_b')::uuid) then
    raise exception 'FAIL: redeemer''s untouched default crew was not removed';
  end if;
end $$;

------------------------------------------------------------------------
-- Anonymous: sees nothing
------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

do $$
begin
  if (select count(*) from public.trips) <> 0 then
    raise exception 'FAIL: anon can read trips';
  end if;
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'FAIL: anon can read profiles';
  end if;
end $$;

reset role;

select 'PASS: all Phase 1 RLS checks' as result;

rollback;
