import { geohash } from "../discovery/geo.ts";
import type { LatLng } from "../discovery/types.ts";
import { fetchJson } from "./http.ts";

const ENDPOINT = "https://app.ticketmaster.com/discovery/v2/events.json";
const RADIUS_MILES = 25;

/**
 * Events near the trailhead around the trip date. The UTC window is wide
 * enough to cover a full local day plus the evening anywhere in the US;
 * the caller filters to the venue-local trip date.
 */
export function fetchEvents(
  apiKey: string,
  at: LatLng,
  isoDate: string,
): Promise<unknown> {
  const params = new URLSearchParams({
    apikey: apiKey,
    geoPoint: geohash(at, 9),
    radius: String(RADIUS_MILES),
    unit: "miles",
    startDateTime: `${isoDate}T04:00:00Z`,
    endDateTime: `${nextDay(isoDate)}T12:00:00Z`,
    size: "100",
    sort: "date,asc",
  });
  return fetchJson("ticketmaster", `${ENDPOINT}?${params}`);
}

function nextDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
