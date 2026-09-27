import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import {
  asWeatherSummary,
  weatherBadge,
  type WeatherBadge,
  type WeatherSummary,
} from "./weather";

/**
 * Latest forecast heads-up per upcoming trip, from its newest weather snapshot.
 * Selects only the JSON fields the badge needs, not the hourly data.
 */
export async function loadWeatherBadges(
  supabase: SupabaseClient<Database>,
  trips: { id: string; trip_date: string | null }[],
): Promise<Map<string, WeatherBadge>> {
  // Skip trips that are over (UTC date minus a day of slack for time zones).
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const dated = trips.filter((t) => t.trip_date && t.trip_date >= yesterday);
  const dateById = new Map(dated.map((t) => [t.id, t.trip_date]));
  const badges = new Map<string, WeatherBadge>();
  if (dated.length === 0) return badges;

  const { data } = await supabase
    .from("weather_snapshots")
    .select(
      "trip_id, fetched_at, date:summary->>date, high_f:summary->high_f, alerts:summary->alerts, storm_window:summary->storm_window, flags:summary->flags",
    )
    .in(
      "trip_id",
      dated.map((t) => t.id),
    )
    .order("fetched_at", { ascending: false });

  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (seen.has(row.trip_id)) continue; // newest first; keep one per trip
    seen.add(row.trip_id);
    const summary = asWeatherSummary(
      row as unknown as WeatherSummary,
      dateById.get(row.trip_id) ?? null,
    );
    const badge = weatherBadge(summary);
    if (badge) badges.set(row.trip_id, badge);
  }
  return badges;
}
