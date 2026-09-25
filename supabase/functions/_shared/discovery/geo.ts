import type { LatLng } from "./types.ts";

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_MILE = 1609.344;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** "0.8 mi from trailhead"; anything under 0.1 mi reads as "At the trailhead". */
export function formatDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return "At the trailhead";
  const rounded = miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
  return `${rounded} mi from trailhead`;
}

/** Bounding box that contains a circle of `radiusM` around `center`. */
export function boundingBox(center: LatLng, radiusM: number) {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/**
 * Cache key for "this area was already queried": coordinates rounded to
 * 0.01° (~1 km) plus the radius, so nearby trailheads share a fetch.
 */
export function areaCacheKey(center: LatLng, radiusM: number): string {
  return `${center.lat.toFixed(2)},${center.lng.toFixed(2)},${radiusM}`;
}

const GEOHASH_ALPHABET = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standard geohash, used for Ticketmaster's `geoPoint` parameter. */
export function geohash(point: LatLng, precision = 9): string {
  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  let hash = "";
  let bits = 0;
  let bitCount = 0;
  let even = true;

  while (hash.length < precision) {
    const range = even ? lngRange : latRange;
    const value = even ? point.lng : point.lat;
    const mid = (range[0] + range[1]) / 2;
    if (value >= mid) {
      bits = (bits << 1) | 1;
      if (even) lngRange = [mid, range[1]];
      else latRange = [mid, range[1]];
    } else {
      bits = bits << 1;
      if (even) lngRange = [range[0], mid];
      else latRange = [range[0], mid];
    }
    even = !even;
    if (++bitCount === 5) {
      hash += GEOHASH_ALPHABET[bits];
      bits = 0;
      bitCount = 0;
    }
  }
  return hash;
}
