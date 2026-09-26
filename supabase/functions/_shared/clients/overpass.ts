import { buildOverpassQuery } from "../discovery/overpass-query.ts";
import type { LatLng } from "../discovery/types.ts";
import { fetchJson } from "./http.ts";

// overpass-api.de rejects the Supabase Edge runtime (it appends its own tag to
// every User-Agent and gets a 406), so use community mirrors that accept it.
// They can be slow, so both are asked at once and the first answer wins;
// results are cached per area for 7 days, which keeps this to two requests
// per area per week.
const ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const TIMEOUT_MS = 60_000;

type OverpassResponse = { elements?: unknown[]; remark?: string };

async function query(
  endpoint: string,
  body: URLSearchParams,
  signal: AbortSignal,
): Promise<OverpassResponse> {
  const json = (await fetchJson("overpass", endpoint, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeoutMs: TIMEOUT_MS,
    retry: false, // the other mirror is the fallback
  })) as OverpassResponse;
  // A timed-out query still returns 200, with a remark and partial results.
  if (json.remark && /error|timed out/i.test(json.remark)) {
    throw new Error(`overpass: ${new URL(endpoint).host}: ${json.remark}`);
  }
  return json;
}

/** One combined query per run; results are cached by the caller. */
export async function fetchOverpass(center: LatLng, radiusM: number): Promise<unknown> {
  const body = new URLSearchParams({ data: buildOverpassQuery(center, radiusM) });
  const done = new AbortController();
  try {
    return await Promise.any(
      ENDPOINTS.map((endpoint) => query(endpoint, body, done.signal)),
    );
  } catch (err) {
    const reasons = err instanceof AggregateError
      ? err.errors.map((e) => (e instanceof Error ? e.message : String(e)))
      : [String(err)];
    throw new Error(`all Overpass mirrors failed: ${reasons.join(" | ")}`);
  } finally {
    done.abort(); // cancel the slower mirror
  }
}
