-- Phase 2 RLS test (discovery tables). Same harness as rls_phase1.sql:
--   npx supabase db query --linked -f supabase/tests/rls_phase2.sql
-- Runs in one transaction and rolls back.

begin;

-- Sign-ups are invite-only (enforce_signup_allowlist), so list the test users.
insert into public.signup_allowlist (email)
values ('rls-a@test.local'), ('rls-b@test.local');

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.local',
   '{"display_name": "Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.local',
   '{"display_name": "Bob"}', 'authenticated', 'authenticated');

-- Seed as the discover function (service role) would.
insert into public.trips (id, crew_id, created_by, name)
select '00000000-0000-4000-8000-0000000000f1', crew_id, user_id, 'Discovery test'
from public.crew_members where user_id = '00000000-0000-4000-8000-00000000000a';

insert into public.places (id, source, source_id, name, category, lat, lng)
values ('00000000-0000-4000-8000-0000000000c1', 'osm', 'node/rls-test', 'Test Brewing',
        'brewery', 39.6, -105.2);

insert into public.discovery_runs (id, trip_id, trigger, status)
values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000f1',
        'manual', 'ok');

insert into public.trip_recommendations (trip_id, item_type, item_id, score, distance_m,
                                         reasons, last_run_id)
values ('00000000-0000-4000-8000-0000000000f1', 'place',
        '00000000-0000-4000-8000-0000000000c1', 1.2, 800, '["0.5 mi from trailhead"]',
        '00000000-0000-4000-8000-0000000000d1');

insert into public.weather_snapshots (trip_id, run_id, daily, hourly)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000d1',
        '{}', '{}');

------------------------------------------------------------------------
-- Alice (member): reads everything for her trip, can pin, can't rescore
------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

do $$
begin
  if (select count(*) from public.trip_recommendation_details
      where trip_id = '00000000-0000-4000-8000-0000000000f1'
        and name = 'Test Brewing' and category = 'brewery') <> 1 then
    raise exception 'FAIL: member cannot read recommendation details view';
  end if;
  if (select count(*) from public.discovery_runs) <> 1 then
    raise exception 'FAIL: member cannot read discovery runs';
  end if;
  if (select count(*) from public.weather_snapshots) <> 1 then
    raise exception 'FAIL: member cannot read weather';
  end if;

  update public.trip_recommendations set pinned = true
  where trip_id = '00000000-0000-4000-8000-0000000000f1';
  if not (select pinned from public.trip_recommendations
          where trip_id = '00000000-0000-4000-8000-0000000000f1') then
    raise exception 'FAIL: member cannot pin';
  end if;

  begin
    update public.trip_recommendations set score = 99
    where trip_id = '00000000-0000-4000-8000-0000000000f1';
    raise exception 'FAIL: member could change score';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.places (source, source_id, name, category, lat, lng)
    values ('osm', 'node/sneaky', 'Sneaky', 'bar', 0, 0);
    raise exception 'FAIL: client could write to places cache';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.source_fetches;
    raise exception 'FAIL: client could read source_fetches';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

------------------------------------------------------------------------
-- Bob (non-member): sees the shared place cache, nothing trip-specific
------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
begin
  if not exists (select 1 from public.places where source_id = 'node/rls-test') then
    raise exception 'FAIL: signed-in user cannot read shared places cache';
  end if;
  if (select count(*) from public.trip_recommendation_details) <> 0 then
    raise exception 'FAIL: non-member can read recommendations via view';
  end if;
  if (select count(*) from public.trip_recommendations) <> 0 then
    raise exception 'FAIL: non-member can read recommendations';
  end if;
  if (select count(*) from public.discovery_runs) <> 0 then
    raise exception 'FAIL: non-member can read runs';
  end if;
  if (select count(*) from public.weather_snapshots) <> 0 then
    raise exception 'FAIL: non-member can read weather';
  end if;

  update public.trip_recommendations set dismissed = true
  where trip_id = '00000000-0000-4000-8000-0000000000f1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: non-member dismissed a recommendation'; end if;
end $$;

reset role;

------------------------------------------------------------------------
-- Anonymous: nothing
------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

do $$
begin
  if (select count(*) from public.places) <> 0 then
    raise exception 'FAIL: anon can read places';
  end if;
  begin
    perform 1 from public.trip_recommendation_details;
    raise exception 'FAIL: anon can query the details view';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

select 'PASS: all Phase 2 RLS checks' as result;

rollback;
