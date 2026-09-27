// Fetches and stores a trip's weather: the Open-Meteo forecast plus National
// Weather Service alerts, summarized for hikers. Used by the full discovery
// run and by the quick weather-only refresh.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchActiveAlerts } from "../_shared/clients/nws.ts";
import { fetchForecast } from "../_shared/clients/open-meteo.ts";
import { alertsForDay } from "../_shared/discovery/alerts.ts";
import { buildDaySummary } from "../_shared/discovery/hiking-weather.ts";
import type { LatLng } from "../_shared/discovery/types.ts";
import { isInForecastWindow } from "../_shared/discovery/weather.ts";

const KEEP_WEATHER_SNAPSHOTS = 3;

type SourceStat = { status: "ok" | "skipped" | "error"; ms?: number; note?: string; error?: string };

export type WeatherResult = {
  stats: { open_meteo: SourceStat; nws: SourceStat };
  /** True when the forecast itself failed (alerts alone don't fail the run). */
  failed: boolean;
  summary: Record<string, unknown> | null;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Whether the trip date is inside the forecast window. */
export function wantsWeather(tripDate: string | null): boolean {
  return tripDate != null &&
    isInForecastWindow(tripDate, new Date().toISOString().slice(0, 10));
}

/**
 * Fetches forecast + alerts in parallel and saves a snapshot. Alerts are
 * best-effort: if NWS fails, the forecast is still saved and the failure is
 * recorded in stats and on the summary.
 */
export async function refreshWeather(
  admin: SupabaseClient,
  tripId: string,
  runId: string | null,
  center: LatLng,
  tripDate: string | null,
): Promise<WeatherResult> {
  if (!tripDate || !wantsWeather(tripDate)) {
    const note = !tripDate ? "trip has no date" : "outside the 16-day forecast window";
    return {
      stats: { open_meteo: { status: "skipped", note }, nws: { status: "skipped", note } },
      failed: false,
      summary: null,
    };
  }

  const started = Date.now();
  const [forecastResult, alertsResult] = await Promise.allSettled([
    fetchForecast(center, tripDate),
    fetchActiveAlerts(center),
  ]);
  const ms = Date.now() - started;

  const nwsStat: SourceStat = alertsResult.status === "fulfilled"
    ? { status: "ok", ms }
    : { status: "error", error: errorMessage(alertsResult.reason), ms };

  if (forecastResult.status === "rejected") {
    return {
      stats: {
        open_meteo: { status: "error", error: errorMessage(forecastResult.reason), ms },
        nws: nwsStat,
      },
      failed: true,
      summary: null,
    };
  }

  const forecast = forecastResult.value;
  const day = buildDaySummary(forecast, tripDate);
  if (!day) {
    // Nothing useful to store; don't replace a good snapshot with an empty one.
    return {
      stats: {
        open_meteo: { status: "error", error: `forecast has no data for ${tripDate}`, ms },
        nws: nwsStat,
      },
      failed: true,
      summary: null,
    };
  }
  const summary = {
    ...day,
    alerts: alertsResult.status === "fulfilled"
      ? alertsForDay(alertsResult.value, tripDate, forecast.utc_offset_seconds ?? 0)
      : [],
    alerts_unavailable: alertsResult.status !== "fulfilled",
  };

  const { error } = await admin.from("weather_snapshots").insert({
    trip_id: tripId,
    run_id: runId,
    daily: forecast.daily ?? {},
    hourly: forecast.hourly ?? {},
    summary,
  });
  if (error) throw new Error(`weather insert: ${error.message}`);

  const { data: old } = await admin
    .from("weather_snapshots")
    .select("id")
    .eq("trip_id", tripId)
    .order("fetched_at", { ascending: false })
    .range(KEEP_WEATHER_SNAPSHOTS, KEEP_WEATHER_SNAPSHOTS + 50);
  if (old && old.length > 0) {
    await admin
      .from("weather_snapshots")
      .delete()
      .in("id", old.map((r: { id: string }) => r.id));
  }

  return {
    stats: { open_meteo: { status: "ok", ms }, nws: nwsStat },
    failed: false,
    summary,
  };
}
