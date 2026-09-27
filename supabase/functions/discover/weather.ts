// Fetches and stores a trip's weather: the Open-Meteo forecast plus National
// Weather Service alerts, summarized for hikers. Used by the full discovery
// run and by the quick weather-only refresh.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { fetchActiveAlerts } from "../_shared/clients/nws.ts";
import { fetchForecast } from "../_shared/clients/open-meteo.ts";
import { alertsForDay } from "../_shared/discovery/alerts.ts";
import { buildDaySummary } from "../_shared/discovery/hiking-weather.ts";
import type { LatLng } from "../_shared/discovery/types.ts";
import { daysUntil, FORECAST_WINDOW_DAYS } from "../_shared/discovery/weather.ts";

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
  if (!tripDate) return false;
  // -1 allows for "today" at the trailhead still being yesterday in UTC.
  const days = daysUntil(tripDate, new Date().toISOString().slice(0, 10));
  return days >= -1 && days < FORECAST_WINDOW_DAYS;
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

  if (forecastResult.status === "rejected") {
    return {
      stats: {
        open_meteo: { status: "error", error: errorMessage(forecastResult.reason), ms },
        nws: alertsResult.status === "fulfilled"
          ? { status: "ok", ms }
          : { status: "error", error: errorMessage(alertsResult.reason), ms },
      },
      failed: true,
      summary: null,
    };
  }

  const forecast = forecastResult.value;
  const day = buildDaySummary(forecast, tripDate);
  const alertsOk = alertsResult.status === "fulfilled";
  const summary = day && {
    ...day,
    alerts: alertsOk
      ? alertsForDay(alertsResult.value, tripDate, forecast.utc_offset_seconds ?? 0)
      : [],
    alerts_unavailable: !alertsOk,
  };

  const { error } = await admin.from("weather_snapshots").insert({
    trip_id: tripId,
    run_id: runId,
    daily: forecast.daily ?? {},
    hourly: forecast.hourly ?? {},
    summary: summary ?? {},
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
    stats: {
      open_meteo: { status: "ok", ms },
      nws: alertsOk
        ? { status: "ok", ms }
        : { status: "error", error: errorMessage(alertsResult.reason), ms },
    },
    failed: false,
    summary,
  };
}
