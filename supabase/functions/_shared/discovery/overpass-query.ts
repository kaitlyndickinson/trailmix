import type { LatLng } from "./types.ts";

/** Radius per group at the default 16 km, scaled to the trip's radius. */
const BASE_RADIUS_M = 16_000;
const GROUP_RADIUS_M = {
  brewery: 16_000,
  food: 8_000, // restaurants within 16 km of a metro trailhead can number in the thousands
  sights: 16_000,
  historic: 10_000,
};

/** The single combined Overpass query from the spec. */
export function buildOverpassQuery(center: LatLng, radiusM: number): string {
  const scale = radiusM / BASE_RADIUS_M;
  const r = (base: number) => Math.round(base * scale);
  const at = `${center.lat},${center.lng}`;

  return `[out:json][timeout:25];
(
  nwr["craft"="brewery"](around:${r(GROUP_RADIUS_M.brewery)},${at});
  nwr["amenity"~"^(restaurant|cafe|pub|bar|biergarten|ice_cream)$"](around:${r(GROUP_RADIUS_M.food)},${at});
  nwr["tourism"~"^(viewpoint|museum|attraction)$"](around:${r(GROUP_RADIUS_M.sights)},${at});
  nwr["historic"]["name"](around:${r(GROUP_RADIUS_M.historic)},${at});
);
out center tags;`;
}
