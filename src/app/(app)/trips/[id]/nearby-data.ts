import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { asWeatherSummary } from "@/lib/weather";
import type { LastRun, Recommendation } from "./nearby";

type SourceStat = { status?: string };

/** Everything the Nearby tab needs, read with the member's own RLS. */
export async function loadNearby(
  supabase: SupabaseClient<Database>,
  tripId: string,
  tripDate: string | null,
) {
  const [recsResult, weatherResult, runResult] = await Promise.all([
    supabase
      .from("trip_recommendation_details")
      .select(
        "item_type, item_id, name, category, score, reasons, pinned, dismissed, url, lat, lng",
      )
      .eq("trip_id", tripId)
      .order("score", { ascending: false }),
    supabase
      .from("weather_snapshots")
      .select("summary, fetched_at")
      .eq("trip_id", tripId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("discovery_runs")
      .select("status, finished_at, stats")
      .eq("trip_id", tripId)
      .neq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (recsResult.error) throw new Error(recsResult.error.message);

  const recommendations: Recommendation[] = (recsResult.data ?? []).flatMap(
    (r) =>
      r.item_type && r.item_id && r.name
        ? [
            {
              item_type: r.item_type,
              item_id: r.item_id,
              name: r.name,
              category: r.category ?? "other",
              score: Number(r.score ?? 0),
              reasons: Array.isArray(r.reasons) ? r.reasons.map(String) : [],
              pinned: r.pinned ?? false,
              dismissed: r.dismissed ?? false,
              url: r.url,
              lat: r.lat,
              lng: r.lng,
            },
          ]
        : [],
  );

  // Only show a forecast for the trip's current date; an older snapshot may
  // be for a date the trip has since moved away from.
  const weather = asWeatherSummary(weatherResult.data?.summary, tripDate);
  const weatherFetchedAt = weather
    ? (weatherResult.data?.fetched_at ?? null)
    : null;

  const run = runResult.data;
  const stats = (run?.stats ?? {}) as Record<string, SourceStat>;
  const lastRun: LastRun | null = run
    ? {
        status: run.status,
        finished_at: run.finished_at,
        failed_sources: Object.entries(stats)
          .filter(([, s]) => s && typeof s === "object" && s.status === "error")
          .map(([name]) => name),
      }
    : null;

  return { recommendations, weather, weatherFetchedAt, lastRun };
}
