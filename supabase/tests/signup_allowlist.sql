-- Signup allowlist + before-user-created hook. Same harness as the RLS tests:
--   npx supabase db query --linked -f supabase/tests/signup_allowlist.sql
-- Runs in one transaction and rolls back.

begin;

insert into public.signup_allowlist (email, note)
values ('allowed-test@example.com', 'test')
on conflict (email) do nothing;

do $$
declare
  ev  jsonb;
  res jsonb;
begin
  -- Allowed email passes (case and surrounding spaces don't matter).
  foreach ev in array array[
    '{"user": {"email": "allowed-test@example.com"}}'::jsonb,
    '{"user": {"email": "  Allowed-Test@Example.COM "}}'::jsonb
  ] loop
    res := public.hook_before_user_created(ev);
    if res <> '{}'::jsonb then
      raise exception 'FAIL: allowlisted email was rejected: %', res;
    end if;
  end loop;

  -- Anyone else is rejected with a 403 and a readable message.
  res := public.hook_before_user_created('{"user": {"email": "stranger@example.com"}}');
  if (res -> 'error' ->> 'http_code')::int <> 403
     or res -> 'error' ->> 'message' not like '%invite-only%' then
    raise exception 'FAIL: non-allowlisted email was not rejected: %', res;
  end if;

  -- No email at all (e.g. phone sign-up) is rejected too.
  res := public.hook_before_user_created('{"user": {"phone": "+15555550100"}}');
  if res -> 'error' is null then
    raise exception 'FAIL: sign-up without an email was allowed';
  end if;

  -- The table rejects badly formatted emails.
  begin
    insert into public.signup_allowlist (email) values ('Not-Lowercase@Example.com');
    raise exception 'FAIL: mixed-case email was stored';
  exception when check_violation then null;
  end;
end $$;

------------------------------------------------------------------------
-- API roles can neither read the list nor call the hook
------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    perform 1 from public.signup_allowlist;
    raise exception 'FAIL: authenticated can read the allowlist';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.hook_before_user_created('{"user": {"email": "x@example.com"}}');
    raise exception 'FAIL: authenticated can call the hook';
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
  begin
    perform public.hook_before_user_created('{"user": {"email": "x@example.com"}}');
    raise exception 'FAIL: anon can call the hook';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- Supabase Auth runs the hook as supabase_auth_admin.
do $$
begin
  if not has_function_privilege('supabase_auth_admin',
       'public.hook_before_user_created(jsonb)', 'execute') then
    raise exception 'FAIL: supabase_auth_admin cannot execute the hook';
  end if;
end $$;

select 'PASS: all signup allowlist checks' as result;

rollback;
