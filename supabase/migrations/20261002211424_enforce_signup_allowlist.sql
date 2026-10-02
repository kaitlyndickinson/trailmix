-- Enforce the signup allowlist in the database itself, with no dashboard hook
-- needed: a BEFORE INSERT trigger on auth.users rejects emails that aren't on
-- the list. Supabase Auth reports this as "Database error saving new user",
-- which the app shows as the invite-only message.

create function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from public.signup_allowlist
    where email = lower(btrim(new.email))
  ) then
    raise exception 'trailmix is invite-only';
  end if;
  return new;
end;
$$;

create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

revoke execute on function public.enforce_signup_allowlist()
  from public, anon, authenticated;

-- One mechanism only: the dashboard hook function is no longer needed.
drop function public.hook_before_user_created(jsonb);
