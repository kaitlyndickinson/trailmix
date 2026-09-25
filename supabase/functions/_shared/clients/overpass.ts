import { buildOverpassQuery } from "../discovery/overpass-query.ts";
import type { LatLng } from "../discovery/types.ts";
import { fetchJson } from "./http.ts";

const ENDPOINT = "https://overpass-api.de/api/interpreter";

/** One combined query per run; results are cached by the caller. */
export function fetchOverpass(center: LatLng, radiusM: number): Promise<unknown> {
  return fetchJson("overpass", ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: buildOverpassQuery(center, radiusM) }),
    timeoutMs: 30_000, // query itself has [timeout:25]
  });
}
