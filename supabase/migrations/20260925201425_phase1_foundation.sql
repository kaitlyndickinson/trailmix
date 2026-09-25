-- Phase 1 foundation: profiles, crews, invites, trips, checklists.
-- RLS is enabled on every table; access is gated by is_crew_member().
-- Column-level grants stop clients from spoofing created_by / checked_by / used_by
-- or moving rows between crews.

------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at   timestamptz not null default now()
);

create table public.crews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id    uuid not null references public.crews (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index crew_members_user_id_idx on public.crew_members (user_id);

create table public.crew_invites (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  -- 8 hex chars, uppercase: no O/I/L ambiguity
  code       text not null unique
             default upper(left(replace(gen_random_uuid()::text, '-', ''), 8)),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references public.profiles (id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index crew_invites_crew_id_idx on public.crew_invites (crew_id);

create table public.trips (
  id                 uuid primary key default gen_random_uuid(),
  crew_id            uuid not null references public.crews (id) on delete cascade,
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  name               text not null check (char_length(name) between 1 and 120),
  trail_name         text,
  trail_url          text check (trail_url is null or trail_url ~* '^https?://'),
  trailhead_lat      double precision check (trailhead_lat between -90 and 90),
  trailhead_lng      double precision check (trailhead_lng between -180 and 180),
  trailhead_town     text,
  trip_date          date,
  discovery_radius_m integer not null default 16000
                     check (discovery_radius_m between 1000 and 50000),
  status             text not null default 'planned'
                     check (status in ('someday', 'planned', 'done')),
  next_refresh_at    timestamptz,
  last_discovered_at timestamptz,
  created_at         timestamptz not null default now(),
  check ((trailhead_lat is null) = (trailhead_lng is null))
);
create index trips_crew_id_idx on public.trips (crew_id);

create table public.checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index checklist_templates_crew_id_idx on public.checklist_templates (crew_id);

create table public.checklist_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 200),
  category    text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index checklist_template_items_template_id_idx
  on public.checklist_template_items (template_id);

create table public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 200),
  category   text,
  sort       integer not null default 0,
  checked    boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index checklist_items_trip_id_idx on public.checklist_items (trip_id);

------------------------------------------------------------------------
-- RLS helpers (security definer avoids recursive policies on crew_members)
------------------------------------------------------------------------

create function public.is_crew_member(p_crew_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.crew_members m
    where m.crew_id = p_crew_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.crew_members m on m.crew_id = t.crew_id
    where t.id = p_trip_id and m.user_id = (select auth.uid())
  );
$$;

create function public.shares_crew_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.crew_members mine
    join public.crew_members theirs on theirs.crew_id = mine.crew_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.is_crew_member(uuid), public.is_trip_member(uuid),
  public.shares_crew_with(uuid) from public, anon;
grant execute on function public.is_crew_member(uuid), public.is_trip_member(uuid),
  public.shares_crew_with(uuid) to authenticated;

------------------------------------------------------------------------
-- RLS policies + column grants
------------------------------------------------------------------------

-- profiles
alter table public.profiles enable row level security;
create policy "Read own and crewmates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_crew_with(id));
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- crews (created only by the signup trigger in Phase 1)
alter table public.crews enable row level security;
create policy "Members read their crews" on public.crews
  for select to authenticated using (public.is_crew_member(id));
create policy "Members rename their crews" on public.crews
  for update to authenticated
  using (public.is_crew_member(id)) with check (public.is_crew_member(id));
revoke insert, update on public.crews from anon, authenticated;
grant update (name) on public.crews to authenticated;

-- crew_members: read-only to clients; changed only by the signup trigger
-- and redeem_crew_invite()
alter table public.crew_members enable row level security;
create policy "Members see their crewmates" on public.crew_members
  for select to authenticated using (public.is_crew_member(crew_id));
revoke insert, update, delete on public.crew_members from anon, authenticated;

-- crew_invites: clients supply only crew_id; code/expiry/created_by are defaults
alter table public.crew_invites enable row level security;
create policy "Members read their crew's invites" on public.crew_invites
  for select to authenticated using (public.is_crew_member(crew_id));
create policy "Members create invites" on public.crew_invites
  for insert to authenticated
  with check (public.is_crew_member(crew_id) and created_by = (select auth.uid()));
create policy "Members revoke invites" on public.crew_invites
  for delete to authenticated using (public.is_crew_member(crew_id));
revoke insert, update on public.crew_invites from anon, authenticated;
grant insert (crew_id) on public.crew_invites to authenticated;

-- trips
alter table public.trips enable row level security;
create policy "Members read trips" on public.trips
  for select to authenticated using (public.is_crew_member(crew_id));
create policy "Members create trips" on public.trips
  for insert to authenticated
  with check (public.is_crew_member(crew_id) and created_by = (select auth.uid()));
create policy "Members update trips" on public.trips
  for update to authenticated
  using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id));
create policy "Members delete trips" on public.trips
  for delete to authenticated using (public.is_crew_member(crew_id));
revoke insert, update on public.trips from anon, authenticated;
grant insert (crew_id, name, trail_name, trail_url, trailhead_lat, trailhead_lng,
  trailhead_town, trip_date, discovery_radius_m, status) on public.trips to authenticated;
grant update (name, trail_name, trail_url, trailhead_lat, trailhead_lng,
  trailhead_town, trip_date, discovery_radius_m, status) on public.trips to authenticated;

-- checklist_templates
alter table public.checklist_templates enable row level security;
create policy "Members manage templates" on public.checklist_templates
  for all to authenticated
  using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id));
revoke insert, update on public.checklist_templates from anon, authenticated;
grant insert (crew_id, name) on public.checklist_templates to authenticated;
grant update (name) on public.checklist_templates to authenticated;

-- checklist_template_items
alter table public.checklist_template_items enable row level security;
create policy "Members manage template items" on public.checklist_template_items
  for all to authenticated
  using (exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and public.is_crew_member(t.crew_id)))
  with check (exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and public.is_crew_member(t.crew_id)));
revoke insert, update on public.checklist_template_items from anon, authenticated;
grant insert (template_id, label, category, sort)
  on public.checklist_template_items to authenticated;
grant update (label, category, sort) on public.checklist_template_items to authenticated;

-- checklist_items
alter table public.checklist_items enable row level security;
create policy "Members manage trip checklist" on public.checklist_items
  for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
revoke insert, update on public.checklist_items from anon, authenticated;
grant insert (trip_id, label, category, sort, checked)
  on public.checklist_items to authenticated;
grant update (label, category, sort, checked) on public.checklist_items to authenticated;

------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------

-- checked_by / checked_at are always set server-side
create function public.set_checklist_item_checked_meta()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.checked and (tg_op = 'INSERT' or not old.checked) then
    new.checked_by := auth.uid();
    new.checked_at := now();
  elsif not new.checked then
    new.checked_by := null;
    new.checked_at := null;
  end if;
  return new;
end;
$$;
create trigger checklist_items_checked_meta
  before insert or update of checked on public.checklist_items
  for each row execute function public.set_checklist_item_checked_meta();

-- Every new crew gets a "Day hike" template
create function public.seed_crew_templates()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_template_id uuid;
begin
  insert into public.checklist_templates (crew_id, name)
  values (new.id, 'Day hike')
  returning id into v_template_id;

  insert into public.checklist_template_items (template_id, category, label, sort) values
    (v_template_id, 'Essentials',    'Water (2L+ each)',                    10),
    (v_template_id, 'Essentials',    'Snacks + lunch',                      20),
    (v_template_id, 'Essentials',    'Sunscreen + lip balm',                30),
    (v_template_id, 'Essentials',    'Sunglasses + hat',                    40),
    (v_template_id, 'Essentials',    'First aid kit',                       50),
    (v_template_id, 'Essentials',    'Headlamp',                            60),
    (v_template_id, 'Essentials',    'Keys, wallet, ID',                    70),
    (v_template_id, 'Navigation',    'Offline map downloaded (AllTrails)',  80),
    (v_template_id, 'Navigation',    'Phone charged + battery pack',        90),
    (v_template_id, 'Clothing',      'Rain jacket',                        100),
    (v_template_id, 'Clothing',      'Warm layer',                         110),
    (v_template_id, 'Clothing',      'Boots + good socks',                 120),
    (v_template_id, 'Gear',          'Trekking poles',                     130),
    (v_template_id, 'Gear',          'Bug spray',                          140),
    (v_template_id, 'Gear',          'TP + trowel',                        150),
    (v_template_id, 'Before you go', 'Check weather (afternoon storms?)',  160),
    (v_template_id, 'Before you go', 'Tell someone the plan',              170),
    (v_template_id, 'Post-hike',     'Change of clothes + cooler in car',  180);
  return new;
end;
$$;
create trigger crews_seed_templates
  after insert on public.crews
  for each row execute function public.seed_crew_templates();

-- On signup: profile + default crew (owner)
create function public.create_user_defaults(p_user_id uuid, p_email text, p_meta jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name    text;
  v_crew_id uuid;
begin
  v_name := left(coalesce(
    nullif(trim(p_meta ->> 'display_name'), ''),
    nullif(split_part(p_email, '@', 1), ''),
    'Hiker'), 60);

  insert into public.profiles (id, display_name) values (p_user_id, v_name);

  insert into public.crews (name, created_by)
  values (left(v_name || '''s crew', 80), p_user_id)
  returning id into v_crew_id;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_crew_id, p_user_id, 'owner');
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.create_user_defaults(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.seed_crew_templates(), public.handle_new_user(),
  public.create_user_defaults(uuid, text, jsonb),
  public.set_checklist_item_checked_meta()
  from public, anon, authenticated;

------------------------------------------------------------------------
-- RPCs
------------------------------------------------------------------------

-- Validates a code, adds the caller to the crew, and marks the code used.
-- Also deletes the caller's own auto-created crew if it's untouched
-- (they're the only member and it has no trips), so each person ends up in one crew.
create function public.redeem_crew_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.crew_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_invite
  from public.crew_invites
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'Invite code not found' using errcode = 'P0002';
  end if;

  -- Already a member: succeed without burning the code
  if exists (select 1 from public.crew_members
             where crew_id = v_invite.crew_id and user_id = v_uid) then
    return v_invite.crew_id;
  end if;

  if v_invite.used_at is not null then
    raise exception 'Invite code already used' using errcode = '22023';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invite code expired' using errcode = '22023';
  end if;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_invite.crew_id, v_uid, 'member');

  update public.crew_invites
  set used_by = v_uid, used_at = now()
  where id = v_invite.id;

  delete from public.crews c
  where c.created_by = v_uid
    and c.id <> v_invite.crew_id
    and not exists (select 1 from public.crew_members m
                    where m.crew_id = c.id and m.user_id <> v_uid)
    and not exists (select 1 from public.trips t where t.crew_id = c.id);

  return v_invite.crew_id;
end;
$$;

-- Copies a template's items onto a trip. security invoker: RLS applies.
create function public.apply_checklist_template(p_trip_id uuid, p_template_id uuid)
returns setof public.checklist_items
language sql security invoker set search_path = ''
as $$
  insert into public.checklist_items (trip_id, label, category, sort)
  select t.id, i.label, i.category,
         i.sort + coalesce((select max(ci.sort) from public.checklist_items ci
                            where ci.trip_id = p_trip_id), 0)
  from public.trips t
  join public.checklist_templates tpl
    on tpl.id = p_template_id and tpl.crew_id = t.crew_id
  join public.checklist_template_items i on i.template_id = tpl.id
  where t.id = p_trip_id
  returning *;
$$;

revoke execute on function public.redeem_crew_invite(text),
  public.apply_checklist_template(uuid, uuid) from public, anon;
grant execute on function public.redeem_crew_invite(text),
  public.apply_checklist_template(uuid, uuid) to authenticated;

------------------------------------------------------------------------
-- Realtime: live checklist sync between phones (RLS-filtered)
------------------------------------------------------------------------

alter publication supabase_realtime add table public.checklist_items;

------------------------------------------------------------------------
-- Backfill any users who signed up before this migration
------------------------------------------------------------------------

select public.create_user_defaults(u.id, u.email, u.raw_user_meta_data)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
