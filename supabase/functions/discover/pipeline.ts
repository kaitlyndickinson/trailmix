// Orchestrates one discovery run (spec §5 steps 1–10). All decisions come
// from the pure modules in _shared/discovery; this file only does I/O.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchForecast } from "../_shared/clients/open-meteo.ts";
import { fetchOverpass } from "../_shared/clients/overpass.ts";
import { fetchEvents } from "../_shared/clients/ticketmaster.ts";
import { dedupePlaces } from "../_shared/discovery/dedupe.ts";
import {
  areaCacheKey,
  boundingBox,
  haversineMeters,
} from "../_shared/discovery/geo.ts";
import { hoursForPlace } from "../_shared/discovery/hours.ts";
import {
  normalizeOverpass,
  normalizeTicketmaster,
} from "../_shared/discovery/normalize.ts";
import { scoreEvent, scorePlace } from "../_shared/discovery/score.ts";
import { topPerCategory } from "../_shared/discovery/select.ts";
import type { Category, EventInput, LatLng } from "../_shared/discovery/types.ts";
import {
  daysUntil,
  FORECAST_WINDOW_DAYS,
  summarizeWeather,
} from "../_shared/discovery/weather.ts";

export type TripForDiscovery = {
  id: string;
  trailhead_lat: number;
  trailhead_lng: number;
  trip_date: string | null;
  discovery_radius_m: number;
};

type SourceStat = {
  status: "ok" | "cached" | "skipped" | "error";
  count?: number;
  ms?: number;
  note?: string;
  error?: string;
};

type RunStatus = "ok" | "partial" | "error";

export type RunResult = {
  run_id: string | null;
  status: RunStatus;
  stats: Record<string, unknown>;
  error?: string;
};

const OVERPASS_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 1000;
const KEEP_WEATHER_SNAPSHOTS = 3;

type PlaceRow = {
  id: string;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

/** Overpass (cached 7 days per area), falling back to cached places on failure. */
async function loadPlaces(
  admin: SupabaseClient,
  center: LatLng,
  radiusM: number,
): Promise<{ places: PlaceRow[]; stat: SourceStat }> {
  const start = Date.now();
  const cacheKey = areaCacheKey(center, radiusM);
  const { data: fetchRow } = await admin
    .from("source_fetches")
    .select("fetched_at")
    .eq("source", "overpass")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  const fresh = fetchRow != null &&
    Date.now() - Date.parse(fetchRow.fetched_at) < OVERPASS_CACHE_MS;

  let fetchError: string | undefined;
  let fetchedCount: number | undefined;
  if (!fresh) {
    try {
      const normalized = normalizeOverpass(await fetchOverpass(center, radiusM));
      const now = new Date().toISOString();
      for (let i = 0; i < normalized.length; i += 500) {
        const chunk = normalized
          .slice(i, i + 500)
          .map((p) => ({ ...p, fetched_at: now }));
        const { error } = await admin
          .from("places")
          .upsert(chunk, { onConflict: "source,source_id" });
        if (error) throw new Error(`places upsert: ${error.message}`);
      }
      const { error } = await admin.from("source_fetches").upsert({
        source: "overpass",
        cache_key: cacheKey,
        fetched_at: now,
        item_count: normalized.length,
      });
      if (error) throw new Error(`source_fetches upsert: ${error.message}`);
      fetchedCount = normalized.length;
    } catch (err) {
      fetchError = errorMessage(err);
    }
  }

  // Candidates always come from the shared cache, fresh or not.
  const box = boundingBox(center, radiusM);
  const places: PlaceRow[] = [];
  for (let from = 0;; from += PAGE) {
    const { data, error } = await admin
      .from("places")
      .select("id, name, category, lat, lng, website, phone, opening_hours")
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`places select: ${error.message}`);
    places.push(...(data as PlaceRow[]));
    if (data.length < PAGE) break;
  }

  const ms = Date.now() - start;
  if (fetchError) {
    return {
      places,
      stat: {
        status: "error",
        error: fetchError,
        note: `fell back to ${places.length} cached places`,
        count: places.length,
        ms,
      },
    };
  }
  return {
    places,
    stat: fresh
      ? { status: "cached", count: places.length, ms }
      : { status: "ok", count: fetchedCount, ms },
  };
}

/** Ticketmaster events on the venue-local trip date, upserted into `events`. */
async function loadEvents(
  admin: SupabaseClient,
  apiKey: string,
  center: LatLng,
  tripDate: string,
): Promise<(EventInput & { id: string })[]> {
  const events = normalizeTicketmaster(await fetchEvents(apiKey, center, tripDate))
    .filter((e) => e.local_date === tripDate);
  if (events.length === 0) return [];

  const now = new Date().toISOString();
  const rows = events.map(({ local_date: _d, local_time: _t, ...row }) => ({
    ...row,
    fetched_at: now,
  }));
  const { data, error } = await admin
    .from("events")
    .upsert(rows, { onConflict: "source,source_id" })
    .select("id, source_id");
  if (error) throw new Error(`events upsert: ${error.message}`);

  const ids = new Map(data.map((r: { id: string; source_id: string }) => [r.source_id, r.id]));
  return events.flatMap((e) => {
    const id = ids.get(e.source_id);
    return id ? [{ ...e, id }] : [];
  });
}

export async function runDiscovery(
  admin: SupabaseClient,
  trip: TripForDiscovery,
  trigger: "manual" | "scheduled",
): Promise<RunResult> {
  const startedAt = Date.now();

  // 1. Load + create the run row.
  const { data: run, error: runError } = await admin
    .from("discovery_runs")
    .insert({ trip_id: trip.id, trigger })
    .select("id")
    .single();
  if (runError) {
    return { run_id: null, status: "error", stats: {}, error: runError.message };
  }

  const stats: Record<string, unknown> = {};
  try {
    const center = { lat: trip.trailhead_lat, lng: trip.trailhead_lng };
    const radiusM = trip.discovery_radius_m;
    const tripDate = trip.trip_date;
    const tmKey = Deno.env.get("TICKETMASTER_API_KEY");
    const utcToday = new Date().toISOString().slice(0, 10);
    // -1 allows for "today" at the trailhead still being yesterday in UTC terms.
    const days = tripDate ? daysUntil(tripDate, utcToday) : null;
    const wantWeather = days != null && days >= -1 && days < FORECAST_WINDOW_DAYS;

    // 2. Fetch in parallel; one failing source makes the run partial.
    const [placesResult, eventsResult, weatherResult] = await Promise.allSettled([
      loadPlaces(admin, center, radiusM),
      tripDate && tmKey
        ? timed(() => loadEvents(admin, tmKey, center, tripDate))
        : Promise.resolve(null),
      wantWeather ? timed(() => fetchForecast(center, tripDate!)) : Promise.resolve(null),
    ]);

    const failures: string[] = [];

    // Places (steps 3–4 happen inside loadPlaces).
    let places: PlaceRow[] = [];
    if (placesResult.status === "fulfilled") {
      places = placesResult.value.places;
      stats.overpass = placesResult.value.stat;
      if (placesResult.value.stat.status === "error") failures.push("overpass");
    } else {
      stats.overpass = { status: "error", error: errorMessage(placesResult.reason) };
      failures.push("overpass");
    }

    // Events.
    let events: (EventInput & { id: string })[] = [];
    if (eventsResult.status === "rejected") {
      stats.ticketmaster = { status: "error", error: errorMessage(eventsResult.reason) };
      failures.push("ticketmaster");
    } else if (eventsResult.value === null) {
      stats.ticketmaster = {
        status: "skipped",
        note: !tripDate ? "trip has no date" : "TICKETMASTER_API_KEY not set",
      };
    } else {
      events = eventsResult.value.value;
      stats.ticketmaster = { status: "ok", count: events.length, ms: eventsResult.value.ms };
    }

    // 5–7. Dedupe, hours, score, keep top N per category.
    const inRadius = places
      .map((p) => ({ ...p, distance_m: haversineMeters(center, p) }))
      .filter((p) => p.distance_m <= radiusM);
    const { kept, collisions } = dedupePlaces(inRadius);

    const placeCandidates = kept.map((p) => {
      const hours = hoursForPlace(p.category, p.opening_hours, tripDate, p);
      const s = scorePlace({
        category: p.category,
        distanceM: p.distance_m,
        radiusM,
        hours,
      });
      return {
        item_type: "place" as const,
        item_id: p.id,
        name: p.name,
        category: p.category as string,
        score: s.score,
        reasons: s.reasons,
        distance_m: Math.round(p.distance_m),
        open_on_trip_date: hours?.open ?? null,
      };
    });

    const eventCandidates = events.map((e) => {
      const distance = e.lat != null && e.lng != null
        ? haversineMeters(center, { lat: e.lat, lng: e.lng })
        : null;
      const s = scoreEvent({
        distanceM: distance,
        radiusM,
        onTripDate: true, // already filtered to the trip date
        localTime: e.local_time,
      });
      return {
        item_type: "event" as const,
        item_id: e.id,
        name: e.name,
        category: "event",
        score: s.score,
        reasons: s.reasons,
        distance_m: distance == null ? null : Math.round(distance),
        open_on_trip_date: null,
      };
    });

    const selected = topPerCategory([...placeCandidates, ...eventCandidates]);

    // 8. Upsert recommendations (pinned/dismissed aren't in the payload, so
    // they survive), then drop rows that fell out, except pinned or dismissed.
    if (selected.length > 0) {
      const { error } = await admin.from("trip_recommendations").upsert(
        selected.map((c) => ({
          trip_id: trip.id,
          item_type: c.item_type,
          item_id: c.item_id,
          score: c.score,
          distance_m: c.distance_m,
          open_on_trip_date: c.open_on_trip_date,
          reasons: c.reasons,
          last_run_id: run.id,
        })),
        { onConflict: "trip_id,item_type,item_id" },
      );
      if (error) throw new Error(`recommendations upsert: ${error.message}`);
    }

    // Only prune types whose source actually answered this run, so an outage
    // doesn't wipe the list.
    const prunable: string[] = [];
    if (!failures.includes("overpass")) prunable.push("place");
    if ((stats.ticketmaster as SourceStat).status === "ok") prunable.push("event");
    if (prunable.length > 0) {
      const { error } = await admin
        .from("trip_recommendations")
        .delete()
        .eq("trip_id", trip.id)
        .in("item_type", prunable)
        .eq("pinned", false)
        .eq("dismissed", false)
        .or(`last_run_id.is.null,last_run_id.neq.${run.id}`);
      if (error) throw new Error(`recommendations prune: ${error.message}`);
    }

    // 9. Weather snapshot + summary.
    if (weatherResult.status === "rejected") {
      stats.open_meteo = { status: "error", error: errorMessage(weatherResult.reason) };
      failures.push("open_meteo");
    } else if (weatherResult.value === null) {
      stats.open_meteo = {
        status: "skipped",
        note: !tripDate ? "trip has no date" : "outside the 16-day forecast window",
      };
    } else {
      const forecast = weatherResult.value.value;
      const summary = summarizeWeather(forecast.daily ?? {}, tripDate!);
      const { error } = await admin.from("weather_snapshots").insert({
        trip_id: trip.id,
        run_id: run.id,
        daily: forecast.daily ?? {},
        hourly: forecast.hourly ?? {},
        summary: { ...summary, timezone: forecast.timezone ?? null },
      });
      if (error) throw new Error(`weather insert: ${error.message}`);
      stats.open_meteo = { status: "ok", ms: weatherResult.value.ms };

      const { data: old } = await admin
        .from("weather_snapshots")
        .select("id")
        .eq("trip_id", trip.id)
        .order("fetched_at", { ascending: false })
        .range(KEEP_WEATHER_SNAPSHOTS, KEEP_WEATHER_SNAPSHOTS + 50);
      if (old && old.length > 0) {
        await admin
          .from("weather_snapshots")
          .delete()
          .in("id", old.map((r: { id: string }) => r.id));
      }
    }

    // 10. Finish.
    Object.assign(stats, {
      candidates: inRadius.length,
      dedupe_collisions: collisions,
      recommendations: selected.length,
      total_ms: Date.now() - startedAt,
    });
    const status: RunStatus = failures.length === 0 ? "ok" : "partial";
    const now = new Date().toISOString();
    await admin
      .from("discovery_runs")
      .update({ status, stats, finished_at: now })
      .eq("id", run.id);
    await admin.from("trips").update({ last_discovered_at: now }).eq("id", trip.id);

    return { run_id: run.id, status, stats };
  } catch (err) {
    const message = errorMessage(err);
    stats.total_ms = Date.now() - startedAt;
    await admin
      .from("discovery_runs")
      .update({
        status: "error",
        error: message,
        stats,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return { run_id: run.id, status: "error", stats, error: message };
  }
}
