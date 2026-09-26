import { categorizeOsm } from "./categories.ts";
import type { EventInput, PlaceInput } from "./types.ts";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// Only the tags worth keeping in places.tags; the rest is noise.
const KEPT_TAGS = [
  "amenity",
  "craft",
  "tourism",
  "historic",
  "shop",
  "cuisine",
  "brewery",
  "outdoor_seating",
  "dog",
  "wheelchair",
  "addr:street",
  "addr:housenumber",
  "addr:city",
];

/**
 * OSM websites are free text: "https://x.com", "www.x.com", or junk.
 * Returns an absolute http(s) URL, or null.
 */
export function normalizeWebsite(raw: string | undefined): string | null {
  const value = raw?.trim().split(/[;\s]/)[0];
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // other schemes (javascript:, mailto:, …)
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}

export function normalizeOverpass(json: unknown): PlaceInput[] {
  const elements = (json as { elements?: OverpassElement[] })?.elements ?? [];
  const places: PlaceInput[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const category = categorizeOsm(tags);
    if (!category) continue;

    const kept: Record<string, string> = {};
    for (const key of KEPT_TAGS) if (tags[key]) kept[key] = tags[key];

    places.push({
      source: "osm",
      source_id: `${el.type}/${el.id}`,
      name,
      category,
      lat,
      lng,
      website: normalizeWebsite(tags.website ?? tags["contact:website"]),
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      opening_hours: tags.opening_hours ?? null,
      tags: kept,
    });
  }
  return places;
}

type TicketmasterEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string };
    end?: { dateTime?: string };
  };
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  _embedded?: {
    venues?: {
      name?: string;
      location?: { latitude?: string; longitude?: string };
    }[];
  };
};

export function normalizeTicketmaster(json: unknown): EventInput[] {
  const events =
    (json as { _embedded?: { events?: TicketmasterEvent[] } })?._embedded
      ?.events ?? [];
  const out: EventInput[] = [];

  for (const ev of events) {
    const start = ev.dates?.start;
    if (!start?.localDate) continue;
    // Date-only events (no time announced) get noon UTC on their local date,
    // which stays on that calendar date across US timezones.
    const startsAt = start.dateTime ?? `${start.localDate}T12:00:00Z`;
    const venue = ev._embedded?.venues?.[0];
    const lat = Number(venue?.location?.latitude);
    const lng = Number(venue?.location?.longitude);
    const classification = ev.classifications?.[0];
    const category = classification?.genre?.name &&
        classification.genre.name !== "Undefined"
      ? classification.genre.name
      : classification?.segment?.name ?? null;

    out.push({
      source: "ticketmaster",
      source_id: ev.id,
      name: ev.name,
      category,
      starts_at: startsAt,
      ends_at: ev.dates?.end?.dateTime ?? null,
      venue_name: venue?.name ?? null,
      lat: Number.isFinite(lat) && venue?.location ? lat : null,
      lng: Number.isFinite(lng) && venue?.location ? lng : null,
      url: ev.url ?? null,
      local_date: start.localDate,
      local_time: start.localTime ?? null,
    });
  }
  return out;
}
