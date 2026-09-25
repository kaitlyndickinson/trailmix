import { haversineMeters } from "./geo.ts";
import type { LatLng } from "./types.ts";

export const DEDUPE_DISTANCE_M = 75;

// Business-form words that differ between listings of the same place.
const NOISE_PHRASES = [
  "brewing company",
  "brewing co",
  "brewery",
  "brewing",
  "taproom",
  "tap room",
  "company",
  "llc",
  "inc",
  "co",
  "the",
];

/** "The Golden Brewing Co., LLC" → "golden". */
export function normalizeName(name: string): string {
  let n = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ");
  for (const phrase of NOISE_PHRASES) {
    n = n.replace(new RegExp(`\\b${phrase}\\b`, "g"), " ");
  }
  n = n.replace(/\s+/g, " ").trim();
  // Don't strip a name down to nothing ("The Brewery" stays distinguishable).
  return n || name.toLowerCase().trim();
}

type Dedupable = LatLng & {
  name: string;
  website?: string | null;
  opening_hours?: string | null;
  phone?: string | null;
};

function richness(p: Dedupable): number {
  return [p.website, p.opening_hours, p.phone].filter(Boolean).length;
}

/**
 * Same normalized name within 75 m counts as one place (e.g. an OSM node and
 * the building way it sits in). Keeps the entry with the most detail.
 */
export function dedupePlaces<T extends Dedupable>(
  places: T[],
): { kept: T[]; collisions: number } {
  const kept: T[] = [];
  const keys: string[] = [];
  let collisions = 0;

  for (const place of places) {
    const key = normalizeName(place.name);
    const matchIndex = kept.findIndex(
      (other, i) =>
        keys[i] === key && haversineMeters(other, place) <= DEDUPE_DISTANCE_M,
    );
    if (matchIndex === -1) {
      kept.push(place);
      keys.push(key);
      continue;
    }
    collisions++;
    if (richness(place) > richness(kept[matchIndex])) kept[matchIndex] = place;
  }
  return { kept, collisions };
}
