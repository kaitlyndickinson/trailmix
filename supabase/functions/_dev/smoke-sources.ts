// Manual smoke check against the real Overpass + Open-Meteo APIs (no DB).
// Usage: OSM_CONTACT_EMAIL=you@example.com deno run --allow-net --allow-env supabase/functions/_dev/smoke-sources.ts [lat] [lng] [YYYY-MM-DD]
import { fetchForecast } from "../_shared/clients/open-meteo.ts";
import { fetchOverpass } from "../_shared/clients/overpass.ts";
import { dedupePlaces } from "../_shared/discovery/dedupe.ts";
import { haversineMeters } from "../_shared/discovery/geo.ts";
import { hoursForPlace } from "../_shared/discovery/hours.ts";
import { normalizeOverpass } from "../_shared/discovery/normalize.ts";
import { scorePlace } from "../_shared/discovery/score.ts";
import { topPerCategory } from "../_shared/discovery/select.ts";
import { buildDaySummary } from "../_shared/discovery/hiking-weather.ts";

const [lat = "39.6364", lng = "-105.2094", date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)] = Deno.args;
const center = { lat: Number(lat), lng: Number(lng) };
const radiusM = 16_000;

const t0 = Date.now();
const [osm, meteo] = await Promise.all([fetchOverpass(center, radiusM), fetchForecast(center, date)]);
const places = normalizeOverpass(osm).map((p) => ({ ...p, distance_m: haversineMeters(center, p) }))
  .filter((p) => p.distance_m <= radiusM);
const { kept, collisions } = dedupePlaces(places);
const scored = kept.map((p) => {
  const s = scorePlace({ category: p.category, distanceM: p.distance_m, radiusM, hours: hoursForPlace(p.category, p.opening_hours, date, p) });
  return { name: p.name, category: p.category, ...s };
});
console.log(`fetched in ${Date.now() - t0}ms: ${places.length} places in radius, ${collisions} dedupe collisions`);
const day = buildDaySummary(meteo, date);
console.log("weather", date, day && { conditions: day.conditions, high: day.high_f, low: day.low_f, storm_window: day.storm_window, start_early: day.start_early, elevation_ft: day.elevation_ft });
for (const f of day?.flags ?? []) console.log(`  [${f.level}] ${f.text}`);
for (const r of topPerCategory(scored, 2)) console.log(`${r.category.padEnd(10)} ${r.score.toFixed(2)}  ${r.name}  — ${r.reasons.join("; ")}`);
