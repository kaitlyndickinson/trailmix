# Trailmix: Spec & Roadmap

> Working name. Rename with find/replace if you pick something else.

A small web app for planning hikes with someone else. Save a trail, pick a date, and share a checklist. The app then finds what's open and happening near the trailhead on that day: breweries, food, viewpoints, events, and weather.

AllTrails already handles finding trails and recording hikes, so this app doesn't try to. The goal is to cut out the manual part where I find a trail and then separately dig around for a brewery, an event, or a cool spot nearby.

---

## 1. Goals and non-goals

**Goals**
- Works well on a phone. It's a PWA I can install to the home screen.
- Two people, one shared space. My fiancé and I see and edit the same trips and checklists.
- Checklists for each trip, started from reusable templates (for example, "Day hike" or "Winter hike").
- Date-aware discovery. Recommendations are pulled for the trip date and refreshed as the date gets closer.
- Explainable recommendations. Every suggestion shows *why* it's there, such as "0.8 mi from trailhead", "open 11–9 Sat", or "event that evening".

**Non-goals (on purpose)**
- GPS tracking, navigation, or offline maps. AllTrails does this.
- A trail database or trail search. I paste a trail link and drop a pin at the trailhead.
- Social feeds, public profiles, reviews.
- LLM-generated recommendations. The ranking is deterministic. An LLM may *summarize* later, but never decides what's on the list.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router, TypeScript), Tailwind | Familiar, deploys cleanly to Vercel |
| PWA | Web app manifest + service worker (Serwist or next-pwa) | Home-screen install, basic offline shell |
| Maps | Leaflet + react-leaflet with OSM tiles | Free, no API key |
| Auth | Supabase Auth, **email + password** (email confirmation off) for now; **email OTP code** (not magic link) once custom SMTP is set up | See gotcha below |
| DB | Supabase Postgres + Row-Level Security | Sharing is enforced in the database, not just the UI |
| Pipeline | Supabase Edge Function (`discover`) | Server-side API keys, runs on demand or on a schedule |
| Scheduling | `pg_cron` + `pg_net` calling the Edge Function | Keeps everything inside Supabase |
| Hosting | Vercel (frontend), Supabase (backend) | Both have free tiers |
| Tests | Deno test (discovery logic + edge function), Playwright (1–2 smoke tests); Vitest only if frontend logic needs it | |

**Gotcha: magic links and PWAs.** On iOS, a magic link opens in Safari, not the installed PWA, so the session doesn't carry over. Use a 6-digit email OTP instead: put `{{ .Token }}` in the Supabase email template and call `verifyOtp` in the app.

**Interim: password auth.** Supabase's built-in email sender is heavily rate-limited, so until custom SMTP is configured, sign-in is email + password with "Confirm email" disabled in the Supabase dashboard. No emails are sent. The switch to email OTP is tracked in Phase 4.

**Gotcha: free-tier pausing.** Free Supabase projects pause after about a week of inactivity. The cron job doesn't count as activity. This is fine for now, but it's worth knowing.

---

## 3. External data sources

| Source | Used for | Key? | Notes |
|---|---|---|---|
| OpenStreetMap Overpass API | Breweries, restaurants, cafes, viewpoints, museums, historic sites | No | Be polite: 1 combined query per run, cache results, set a User-Agent. overpass-api.de rejects the Supabase Edge runtime (it appends its own tag to the User-Agent → 406), so the function queries two community mirrors in parallel and takes the first answer |
| Open-Meteo | Daily and hourly forecast | No | Forecast only goes about 16 days out. Hourly data matters for Colorado afternoon thunderstorms |
| Ticketmaster Discovery API | Events on the trip date | Free key | Skews toward bigger venues and misses small brewery trivia nights. That's a known gap (see Open Questions) |
| Nominatim (OSM) | Reverse geocode for the trailhead's town *(later)* | No | 1 request/sec max, needs a User-Agent with contact info. Also blocks the Edge runtime's User-Agent, so call it from the Next.js server |
| Photon (komoot, OSM-based) | Trailhead search by name | No | Called from a Next.js server action on an explicit Search tap (no search-as-you-type) |
| NPS API *(later)* | Park alerts and closures | Free key | Only relevant for NPS units |
| Foursquare Places *(later, optional)* | Richer place data and popularity | Free tier | Only if OSM data proves too thin |
| COTREX *(later, optional)* | Colorado trail geometry | No | For "on the way home" routing ideas |

AllTrails has no public API. A trip stores the AllTrails URL as a link, plus the trailhead coordinates I set myself.

---

## 4. Data model

All tables have `id uuid pk default gen_random_uuid()` and `created_at timestamptz default now()` unless noted.

### Sharing: crews
A **crew** is a shared space ("Kaitlyn + fiancé"). Trips belong to a crew, so everything is shared automatically. There's no per-trip invite flow.

```
profiles            (id = auth.users.id, display_name, created_at)
crews               (id, name, created_by)
crew_members        (crew_id, user_id, role: 'owner'|'member', pk(crew_id, user_id))
crew_invites        (id, crew_id, code text unique, created_by, expires_at, used_by, used_at)
```

### Trips and checklists
```
trips
  id, crew_id, created_by
  name                 -- "Mt. Falcon Sunday"
  trail_name, trail_url
  trailhead_lat, trailhead_lng
  trailhead_town       -- from reverse geocode, for display
  trip_date date       -- nullable (a "someday" trip has no date)
  discovery_radius_m int default 16000
  status: 'someday'|'planned'|'done'
  next_refresh_at timestamptz    -- set by the pipeline
  last_discovered_at timestamptz

checklist_templates      (id, crew_id, name)
checklist_template_items (id, template_id, label, category, sort)
checklist_items          (id, trip_id, label, category, sort, checked bool, checked_by, checked_at)
```

### Discovery
Places and events are a **shared cache** across trips, deduplicated by source ID. Recommendations link a trip to cached items.

```
places
  id, source: 'osm'|'foursquare', source_id, unique(source, source_id)
  name, category        -- normalized: brewery|restaurant|cafe|bar|viewpoint|museum|historic|ice_cream|other
  lat, lng, website, phone
  opening_hours text    -- raw OSM opening_hours string
  tags jsonb            -- raw source payload (trimmed)
  fetched_at

events
  id, source: 'ticketmaster', source_id, unique(source, source_id)
  name, category, starts_at, ends_at
  venue_name, lat, lng, url
  fetched_at

discovery_runs
  id, trip_id, trigger: 'manual'|'scheduled'
  started_at, finished_at, status: 'running'|'ok'|'partial'|'error'
  stats jsonb           -- per-source counts, timings, errors
  error text

trip_recommendations
  trip_id, item_type: 'place'|'event', item_id, pk(trip_id, item_type, item_id)
  score numeric, distance_m int
  open_on_trip_date bool null   -- null = unknown hours
  reasons jsonb                 -- ["0.8 mi from trailhead", "Open 11:00–21:00 Sat"]
  last_run_id
  pinned bool default false     -- user state, survives refreshes
  dismissed bool default false  -- user state, survives refreshes

weather_snapshots
  id, trip_id, run_id, fetched_at
  daily jsonb, hourly jsonb
  summary jsonb   -- derived: high/low, precip %, storm window, sunrise/sunset

crew_preferences          -- Phase 4; until then scoring uses built-in default weights
  crew_id pk, category_weights jsonb   -- {"brewery": 1.5, "museum": 0.5, ...}

source_fetches            -- Overpass cache bookkeeping; internal (RLS on, no client access)
  source, cache_key, pk(source, cache_key)   -- cache_key = lat/lng rounded to 0.01° + radius
  fetched_at, item_count

trip_recommendation_details   -- view (security_invoker) joining recommendations to places/events for the Nearby tab
```

### RLS
- Create a `security definer` helper `is_crew_member(crew_id uuid) returns bool`. This avoids recursive policies on `crew_members`.
- `trips` and `checklist_*` are readable and writable when `is_crew_member(<the trip's crew_id>)`. `trip_recommendations`, `weather_snapshots`, and `discovery_runs` are readable by members; only the Edge Function writes them, except that members can update `pinned` and `dismissed`.
- `places` and `events` are readable by any authenticated user. Only the service role writes to them (from the Edge Function).
- Invites are redeemed through an RPC, `redeem_crew_invite(code)`, that validates the code and inserts into `crew_members`. Codes are single-use and expire after 7 days. Redeeming also deletes the redeemer's own auto-created crew if it's untouched (no other members, no trips), so each person normally belongs to exactly one crew.
- On signup, a trigger creates the user's `profiles` row and a default crew.

---

## 5. The discovery pipeline

### Trigger paths
1. **Manual.** A "Refresh" button on the trip page invokes `discover` with `{ trip_id }`. The function checks that the caller is a crew member.
2. **Scheduled.** An hourly `pg_cron` job selects trips where `trip_date >= today and next_refresh_at <= now()` (limit 10). It calls `discover` through `pg_net.http_post` using a service key stored in Supabase Vault.

### Refresh cadence
The pipeline sets `next_refresh_at` after each run, based on days until the trip:

| Days out | Next refresh |
|---|---|
| > 14 | 7 days |
| 3–14 | 24 hours |
| 1–2 | 6 hours |
| Day of | Once at 6am local, then stop |
| Past | Stop, and mark `done` after the date |

Weather is only fetched within the 16-day forecast window.

### Steps inside `discover(trip_id)`
1. **Load** the trip and create a `discovery_runs` row with status `running`.
2. **Fetch in parallel** with `Promise.allSettled`. One source failing makes the run `partial`, not failed.
   - **Overpass:** one combined query at the trip's radius for every group. (An earlier per-category radius, with food at half the radius, hid the nearest town from mountain trailheads such as Georgetown from Mt. Bierstadt. Dense metro areas stay cheap because hours are only evaluated for a shortlist of 20 per category.) The radius is chosen per trip on the Nearby tab: 5, 10, 15, or 25 mi.
     ```
     [out:json][timeout:25];
     (
       nwr["craft"="brewery"](around:{radius},{lat},{lng});
       nwr["amenity"~"^(restaurant|cafe|pub|bar|biergarten|ice_cream)$"](around:{radius},{lat},{lng});
       nwr["tourism"~"^(viewpoint|museum|attraction)$"](around:{radius},{lat},{lng});
       nwr["historic"]["name"](around:{radius},{lat},{lng});
     );
     out center tags;
     ```
     Skip the fetch if this area was queried in the last 7 days. Store a cache key from rounded coordinates plus radius.
   - **Ticketmaster:** events whose start falls within the trip date (local day, plus the evening) inside the trip radius (at least 10 miles). Use `geoPoint` (a geohash); the older `latlong` param is deprecated.
   - **Open-Meteo:** daily and hourly data for the trip date with `timezone=auto`.
3. **Normalize** each source into the common `places` / `events` shape, including category mapping.
4. **Upsert** into `places` and `events` on `(source, source_id)`.
5. **Dedupe** across sources: same normalized name (lowercase, stripped of "brewing co", "LLC", and similar) and within 75 m counts as one place.
6. **Compute hours.** Evaluate `opening_hours` for the trip date with the `opening_hours` npm package (import via `npm:` in Deno). Record true, false, or null for unknown. Viewpoints and historic sites with no listed hours are treated as always accessible (no hours factor, no "unknown" penalty).
7. **Score** each candidate (see below) and keep the top N per category.
8. **Write recommendations.** Upsert `trip_recommendations` while preserving `pinned` and `dismissed`. Remove rows that dropped out unless they are pinned or dismissed (so a dismissed place stays hidden if it comes back). Only prune item types whose source answered this run.
9. **Derive a weather summary.** Include high and low, max precipitation chance, and a **storm window** (hours with precipitation probability ≥ 40% or thunderstorm weather codes). Flag "start early" if storms are likely after noon.
10. **Finish.** Set run status and stats, `last_discovered_at`, and `next_refresh_at`.

### Scoring (v1, deterministic)
```
score = category_weight
      × distance_factor        # 1.0 at 0 m, decaying to ~0.3 at the radius edge
      × open_factor            # 1.0 open, 0.6 unknown, 0.1 closed on trip date
      × event_bonus            # 1.3 if it's an event on the trip date
```
Each factor that fires adds a human-readable string to `reasons`. Pure logic (normalization, dedupe, hours, scoring, refresh cadence) lives in `supabase/functions/_shared/discovery/`: plain TypeScript, no I/O, explicit `.ts` import extensions, tested with `deno test`. The Next.js app never imports it; it only calls the `discover` function.

---

## 6. Screens

1. **Sign in:** email + password, with a sign-up form that also asks for a display name. (Later: enter email, then the 6-digit code.)
2. **Trips:** list grouped into Upcoming, Someday, and Done. There's a big "+ Trip" button.
3. **New/Edit trip:** name, AllTrails URL, date, and trailhead pin: search by name (Photon), paste coordinates or a Google/Apple Maps link (share links are resolved server-side, Google hosts only), tap the map, or use the current location; "Open in Google Maps" checks the name there. The checklist is optional: "No checklist" by default, or start from a template.
4. **Trip detail**, with three tabs:
   - **Checklist:** checkboxes showing who checked each item, with add, reorder, and delete. A trip with no checklist offers its crew's templates.
   - **Nearby:** weather card at the top, then a **Pinned** section (pinned items from any category, tagged with their category), then recommendations grouped by category. Each shows its reasons and pin/dismiss actions. "Updated 3h ago", a Refresh button, and the search radius chips sit at the top; a failed source shows a notice with Retry.
   - **Map:** trailhead plus recommendation markers.
5. **Crew:** members, an invite code or link, and category preference sliders.
6. **Templates:** manage checklist templates.

---

## 7. Roadmap

Each phase ends in something deployed and usable.

### Phase 0: Setup (~30 min)
- [x] Repo, Next.js scaffold, Tailwind, ESLint/Prettier
- [x] Supabase project and local CLI (`supabase init`, `supabase link`)
- [x] Vercel project linked to the repo, env vars set
- [x] PWA manifest and icon so it installs to the home screen

**Done when:** a blank app is deployed and installable on my phone.

### Phase 1: Usable for tomorrow's hike
- [x] Email + password auth (confirmation off), profiles trigger, default crew on signup
- [x] Crew invite code and redeem RPC
- [x] Trips CRUD with a trailhead pin
- [x] Checklist templates and per-trip checklist (seed a "Day hike" template)
- [x] RLS on everything above, with a test that a non-member can't read a trip
- [x] ~~`discover` Edge Function, preview mode~~: skipped; the full Phase 2 function shipped instead.

**Done when:** both of us are in one crew, can see the same trip, and check items off on our phones.

### Phase 2: Discovery pipeline v1
- [x] Discovery tables and migrations
- [x] `discover` Edge Function: fetch, normalize, upsert, dedupe, hours, score, write recommendations
- [x] Ticketmaster events
- [x] `discovery_runs` logging with partial-failure handling
- [x] Pin and dismiss that survive refreshes
- [x] Unit tests for normalization, dedupe, hours, and scoring

**Done when:** the manual Refresh fills Nearby with ranked, explained results, and a failing source doesn't break the run.

### Phase 3: Scheduled freshness
- [ ] `pg_cron` hourly job, `pg_net` call, service key in Vault
- [ ] Cadence logic for `next_refresh_at`
- [ ] "Updated X ago", staleness indicator, run history view (small, for debugging)
- [ ] Weather storm window and "start early" flag

**Done when:** a trip two weeks out refreshes on its own and ramps up as the date approaches.

### Phase 4: Ranking and polish
- [ ] Crew category preferences feed into scoring
- [ ] Map tab
- [ ] "What changed since last refresh" (new event added, place now closed)
- [ ] Offline-friendly checklist (cached shell, optimistic updates)
- [ ] Custom SMTP, then switch auth to email OTP (`{{ .Token }}` template + `verifyOtp`)

### Phase 5: Portfolio-ready
- [x] README with a screenshot, an architecture diagram (Mermaid), a "why this exists" section, and setup steps
- [ ] `docs/decisions/` with short ADRs (OTP vs magic link, crews vs per-trip sharing, deterministic ranking, shared place cache)
- [ ] GitHub Actions: lint, typecheck, Vitest, Deno test
- [ ] Seed script and `.env.example` (`.env.example` done)

### Later / maybe
- GPX upload to compute "on the way home" places along the drive
- NPS alerts; fire bans and closures
- LLM-written one-paragraph "day plan" built from the already-ranked results
- Web push notifications ("new event near Saturday's hike")
- Post-hike notes and photos on done trips

---

## 8. Open questions
- **Small local events.** Ticketmaster misses brewery trivia nights, markets, and similar. Options: PredictHQ (paid), specific venue calendars, or accept the gap. Eventbrite's public search API is gone.
- **Drive time vs. straight-line distance.** Straight-line distance is fine for v1. OSRM could add real drive times later.
- **Dedupe accuracy.** Name plus 75 m is a guess. Log collisions in `stats` and tune.
- **Overpass reliability.** overpass-api.de rejects the Supabase Edge runtime (it appends its own User-Agent tag; 406), so the function races two community mirrors (private.coffee, mail.ru) and falls back to cached places if both fail. The mirrors can take 20–60 s. If they get unreliable, options are a self-hosted Overpass or moving the fetch to the Next.js server.

---

## 9. Environment variables

**Vercel / Next.js**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # or publishable key, depending on project
OSM_CONTACT_EMAIL=                    # server-only (no NEXT_PUBLIC_): User-Agent for trailhead search
```

**Supabase secrets (Edge Functions)**, set with `supabase secrets set KEY=value`
```
TICKETMASTER_API_KEY=
OSM_CONTACT_EMAIL=                    # User-Agent contact for Overpass mirrors
```
The service role key is available to Edge Functions automatically. Never ship it to the client.
