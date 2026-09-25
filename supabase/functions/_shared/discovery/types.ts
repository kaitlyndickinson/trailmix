export type Category =
  | "brewery"
  | "restaurant"
  | "cafe"
  | "bar"
  | "viewpoint"
  | "museum"
  | "historic"
  | "ice_cream"
  | "other";

export type LatLng = { lat: number; lng: number };

/** A place in the shape of the `places` table (minus id/timestamps). */
export type PlaceInput = {
  source: "osm";
  source_id: string;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  tags: Record<string, string>;
};

/** An event in the shape of the `events` table, plus its local date/time. */
export type EventInput = {
  source: "ticketmaster";
  source_id: string;
  name: string;
  category: string | null;
  starts_at: string; // ISO timestamp
  ends_at: string | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  local_date: string; // YYYY-MM-DD at the venue
  local_time: string | null; // HH:MM:SS at the venue
};

export type Scored = {
  score: number;
  reasons: string[];
};
