import type { LatLng } from "./types.ts";

/**
 * The single combined Overpass query. Every group uses the trip's full
 * radius: mountain trailheads are often 10–20 km from the nearest town, and a
 * smaller food radius hid places like Georgetown from Mt. Bierstadt. The
 * pipeline filters candidates with the same radius, so results don't depend
 * on what other trips have cached nearby, and it only evaluates hours for a
 * shortlist, which keeps dense metro areas cheap.
 */
export function buildOverpassQuery(center: LatLng, radiusM: number): string {
  const around = `(around:${Math.round(radiusM)},${center.lat},${center.lng})`;

  return `[out:json][timeout:25];
(
  nwr["craft"="brewery"]${around};
  nwr["amenity"~"^(restaurant|cafe|pub|bar|biergarten|ice_cream)$"]${around};
  nwr["tourism"~"^(viewpoint|museum|attraction)$"]${around};
  nwr["historic"]["name"]${around};
);
out center tags;`;
}
