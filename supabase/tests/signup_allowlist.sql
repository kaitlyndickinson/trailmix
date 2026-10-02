-- Invite-only sign-ups: the enforce_signup_allowlist trigger on auth.users.
-- Same harness as the RLS tests:
--   npx supabase db query --linked -f supabase/tests/signup_allowlist.sql
-- Runs in one transaction and rolls back.

begin;

insert into public.signup_allowlist (email, note)
values ('allowed-test@example.com', 'test');

do $$
begin
  -- A listed email can be created (case and spaces don't matter), and the
  -- signup trigger still gives it a profile and crew.
  insert into auth.users (id, email, aud, role)
  values ('00000000-0000-4000-8000-0000000000e1', '  Allowed-Test@Example.COM ',
          'authenticated', 'authenticated');
  if not exists (select 1 from public.profiles
                 where id = '00000000-0000-4000-8000-0000000000e1') then
    raise exception 'FAIL: allowlisted user did not get a profile';
  end if;

  -- Anyone else is rejected before the row is written.
  begin
    insert into auth.users (id, email, aud, role)
    values ('00000000-0000-4000-8000-0000000000e2', 'stranger@example.com',
            'authenticated', 'authenticated');
    raise exception 'FAIL: non-allowlisted email was accepted';
  exception when raise_exception then
    if sqlerrm <> 'trailmix is invite-only' then raise; end if;
  end;

  -- No email at all (e.g. phone or anonymous sign-up) is rejected too.
  begin
    insert into auth.users (id, phone, aud, role)
    values ('00000000-0000-4000-8000-0000000000e3', '15555550100',
            'authenticated', 'authenticated');
    raise exception 'FAIL: sign-up without an email was accepted';
  exception when raise_exception then
    if sqlerrm <> 'trailmix is invite-only' then raise; end if;
  end;

  -- The list only stores normalized emails.
  begin
    insert into public.signup_allowlist (email) values ('Not-Lowercase@Example.com');
    raise exception 'FAIL: mixed-case email was stored';
  exception when check_violation then null;
  end;
end $$;

------------------------------------------------------------------------
-- API roles can't read or change the list
------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    perform 1 from public.signup_allowlist;
    raise exception 'FAIL: authenticated can read the allowlist';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.signup_allowlist (email) values ('sneaky@example.com');
    raise exception 'FAIL: authenticated can add to the allowlist';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

do $$
begin
  begin
    perform 1 from public.signup_allowlist;
    raise exception 'FAIL: anon can read the allowlist';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

select 'PASS: all signup allowlist checks' as result;

rollback;
