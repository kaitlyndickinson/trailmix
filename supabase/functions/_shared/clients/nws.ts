import type { LatLng } from "../discovery/types.ts";
import { fetchJson } from "./http.ts";

// National Weather Service active alerts for a point. Free, no key; requires a
// User-Agent with contact info (fetchJson sets it). US only: elsewhere it
// errors, which the caller records as a failed source.
const ENDPOINT = "https://api.weather.gov/alerts/active";

export function fetchActiveAlerts(at: LatLng): Promise<unknown> {
  const point = `${at.lat.toFixed(4)},${at.lng.toFixed(4)}`;
  return fetchJson("nws", `${ENDPOINT}?point=${point}`, {
    headers: { Accept: "application/geo+json" },
  });
}
