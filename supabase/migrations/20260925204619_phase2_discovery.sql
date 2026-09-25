-- Phase 2: discovery cache, runs, recommendations, weather.
-- places/events are a shared cache written only by the discover function (service role).

create table public.places (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('osm', 'foursquare')),
  source_id     text not null,
  name          text not null,
  category      text not null check (category in ('brewery', 'restaurant', 'cafe', 'bar',
                  'viewpoint', 'museum', 'historic', 'ice_cream', 'other')),
  lat           double precision not null,
  lng           double precision not null,
  website       text,
  phone         text,
  opening_hours text,
  tags          jsonb not null default '{}',
  fetched_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (source, source_id)
);
create index places_lat_lng_idx on public.places (lat, lng);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('ticketmaster')),
  source_id   text not null,
  name        text not null,
  category    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  venue_name  text,
  lat         double precision,
  lng         double precision,
  url         text,
  fetched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (source, source_id)
);
create index events_starts_at_idx on public.events (starts_at);

create table public.discovery_runs (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  trigger     text not null check (trigger in ('manual', 'scheduled')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running'
              check (status in ('running', 'ok', 'partial', 'error')),
  stats       jsonb not null default '{}',
  error       text,
  created_at  timestamptz not null default now()
);
create index discovery_runs_trip_started_idx on public.discovery_runs (trip_id, started_at desc);

create table public.trip_recommendations (
  trip_id           uuid not null references public.trips (id) on delete cascade,
  item_type         text not null check (item_type in ('place', 'event')),
  item_id           uuid not null,  -- places.id or events.id (polymorphic, no FK)
  score             numeric not null,
  distance_m        integer,
  open_on_trip_date boolean,        -- null = unknown hours
  reasons           jsonb not null default '[]',
  last_run_id       uuid references public.discovery_runs (id) on delete set null,
  pinned            boolean not null default false,
  dismissed         boolean not null default false,
  created_at        timestamptz not null default now(),
  primary key (trip_id, item_type, item_id)
);

create table public.weather_snapshots (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  run_id     uuid references public.discovery_runs (id) on delete set null,
  fetched_at timestamptz not null default now(),
  daily      jsonb not null,
  hourly     jsonb not null,
  summary    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index weather_snapshots_trip_fetched_idx on public.weather_snapshots (trip_id, fetched_at desc);

-- Overpass cache bookkeeping: "this area was fetched at T".
create table public.source_fetches (
  source     text not null,
  cache_key  text not null,          -- e.g. rounded lat/lng + radius
  fetched_at timestamptz not null default now(),
  item_count integer not null default 0,
  primary key (source, cache_key)
);

------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------

alter table public.places enable row level security;
create policy "Signed-in users read places" on public.places
  for select to authenticated using (true);
revoke insert, update, delete on public.places from anon, authenticated;

alter table public.events enable row level security;
create policy "Signed-in users read events" on public.events
  for select to authenticated using (true);
revoke insert, update, delete on public.events from anon, authenticated;

alter table public.discovery_runs enable row level security;
create policy "Members read their trips' runs" on public.discovery_runs
  for select to authenticated using (public.is_trip_member(trip_id));
revoke insert, update, delete on public.discovery_runs from anon, authenticated;

alter table public.trip_recommendations enable row level security;
create policy "Members read recommendations" on public.trip_recommendations
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "Members pin and dismiss" on public.trip_recommendations
  for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
revoke insert, update, delete on public.trip_recommendations from anon, authenticated;
grant update (pinned, dismissed) on public.trip_recommendations to authenticated;

alter table public.weather_snapshots enable row level security;
create policy "Members read weather" on public.weather_snapshots
  for select to authenticated using (public.is_trip_member(trip_id));
revoke insert, update, delete on public.weather_snapshots from anon, authenticated;

-- Internal only: RLS on, no policies, no grants.
alter table public.source_fetches enable row level security;
revoke all on public.source_fetches from anon, authenticated;

------------------------------------------------------------------------
-- One query for the Nearby tab. security_invoker: RLS of the caller applies.
------------------------------------------------------------------------

create view public.trip_recommendation_details
with (security_invoker = true) as
select
  r.trip_id, r.item_type, r.item_id, r.score, r.distance_m,
  r.open_on_trip_date, r.reasons, r.pinned, r.dismissed, r.last_run_id,
  coalesce(p.name, e.name)                            as name,
  case when r.item_type = 'event' then 'event' else p.category end as category,
  coalesce(p.lat, e.lat)                              as lat,
  coalesce(p.lng, e.lng)                              as lng,
  coalesce(p.website, e.url)                          as url,
  p.opening_hours,
  e.starts_at, e.venue_name
from public.trip_recommendations r
left join public.places p on r.item_type = 'place' and p.id = r.item_id
left join public.events e on r.item_type = 'event' and e.id = r.item_id;

revoke all on public.trip_recommendation_details from anon;
grant select on public.trip_recommendation_details to authenticated;
