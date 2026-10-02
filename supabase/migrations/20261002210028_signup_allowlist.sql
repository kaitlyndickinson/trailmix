-- Invite-only sign-ups: an email allowlist checked by Supabase Auth's
-- "before user created" hook. Emails are added with SQL, not in migrations
-- (the repo is public).

create table public.signup_allowlist (
  email      text primary key
             check (email = lower(btrim(email)) and email like '%_@_%'),
  note       text,
  created_at timestamptz not null default now()
);

-- Internal only: RLS on, no policies, no grants for API roles.
alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

-- Called by Supabase Auth before creating any user. {} allows; an error
-- object rejects the sign-up with that message.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if v_email is not null and exists (
    select 1 from public.signup_allowlist where email = v_email
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'trailmix is invite-only. Ask the person who shared it to add your email.'
  ));
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb)
  from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb)
  to supabase_auth_admin;
