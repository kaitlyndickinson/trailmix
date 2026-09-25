import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { LastRun, Recommendation, WeatherSummary } from "./nearby";

type SourceStat = { status?: string };

/** Everything the Nearby tab needs, read with the member's own RLS. */
export async function loadNearby(
  supabase: SupabaseClient<Database>,
  tripId: string,
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
      .select("summary")
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

  const summary = weatherResult.data?.summary as
    WeatherSummary | null | undefined;
  const weather = summary && summary.high_f !== undefined ? summary : null;

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

  return { recommendations, weather, lastRun };
}
