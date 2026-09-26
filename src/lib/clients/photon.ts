import { fetchWithRetry } from "./http";

// Photon (photon.komoot.io): free OpenStreetMap geocoder built for search.
// Called on an explicit Search tap, never per keystroke.
const ENDPOINT = "https://photon.komoot.io/api/";

export type PlaceResult = {
  name: string;
  kind: string;
  detail: string;
  lat: number;
  lng: number;
};

// What hikers usually mean, in order of preference.
const KINDS: [string, string, number][] = [
  ["highway/trailhead", "Trailhead", 0],
  ["highway/path", "Trail", 1],
  ["highway/footway", "Trail", 1],
  ["natural/peak", "Peak", 2],
  ["amenity/parking", "Parking", 3],
  ["leisure/park", "Park", 4],
  ["boundary/protected_area", "Park", 4],
  ["leisure/nature_reserve", "Park", 4],
  ["natural/water", "Lake", 5],
  ["tourism/viewpoint", "Viewpoint", 5],
];

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    city?: string;
    county?: string;
    state?: string;
  };
};

function describe(p: PhotonFeature["properties"]): {
  kind: string;
  rank: number;
} {
  const match = KINDS.find(([tag]) => tag === `${p.osm_key}/${p.osm_value}`);
  if (match) return { kind: match[1], rank: match[2] };
  if (p.osm_key === "place") return { kind: "Town", rank: 6 };
  return { kind: "Place", rank: 7 };
}

export async function searchPlaces(
  query: string,
  near: { lat: number; lng: number },
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "10",
    lang: "en",
    lat: String(near.lat),
    lon: String(near.lng),
  });
  const res = await fetchWithRetry(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status}).`);
  const json = (await res.json()) as { features?: PhotonFeature[] };

  return (
    (json.features ?? [])
      .filter((f) => f.properties.name)
      .map((f, index) => {
        const p = f.properties;
        const { kind, rank } = describe(p);
        return {
          index,
          rank,
          name: p.name!,
          kind,
          detail: [p.city, p.county && `${p.county} County`, p.state]
            .filter(Boolean)
            .join(", "),
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        };
      })
      // Hiking-relevant kinds first; otherwise keep Photon's relevance order.
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, 6)
      .map(({ name, kind, detail, lat, lng }) => ({
        name,
        kind,
        detail,
        lat,
        lng,
      }))
  );
}
