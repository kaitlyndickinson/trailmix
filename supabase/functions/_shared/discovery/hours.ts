import OpeningHours from "npm:opening_hours@3.15.0";
import type { Category, LatLng } from "./types.ts";

// Outdoor spots rarely list hours because they don't have any.
const ALWAYS_ACCESSIBLE: ReadonlySet<Category> = new Set(["viewpoint", "historic"]);

/**
 * Hours to score a place by, or null when hours don't apply: no trip date,
 * or an outdoor spot with no listed hours (so it isn't penalized as "unknown").
 */
export function hoursForPlace(
  category: Category,
  openingHours: string | null,
  isoDate: string | null,
  at: LatLng,
): HoursResult | null {
  if (!isoDate) return null;
  if (!openingHours && ALWAYS_ACCESSIBLE.has(category)) return null;
  return hoursOnDate(openingHours, isoDate, at);
}

export type HoursResult = {
  open: boolean | null; // null = unknown
  reason: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Sun-relative rules resolve to real instants, not wall-clock times, so their
// clock times would be off by the runtime's UTC offset. Describe them instead.
const SUN_RELATIVE = /\b(sunrise|sunset|dawn|dusk)\b/i;

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Evaluates an OSM opening_hours string for a calendar date at the trailhead.
 *
 * Everything is wall-clock time: the day is built with local-time Date
 * constructors and read back with local getters, which is what the
 * opening_hours library uses too, so the runtime's timezone cancels out.
 */
export function hoursOnDate(
  openingHours: string | null,
  isoDate: string,
  at: LatLng,
): HoursResult {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d);
  const dayEnd = new Date(y, m - 1, d + 1);
  const weekday = WEEKDAYS[dayStart.getDay()];

  if (!openingHours) return { open: null, reason: "Hours unknown" };

  let intervals: [Date, Date, boolean, string | undefined][];
  try {
    const oh = new OpeningHours(openingHours, {
      // Strings, as in a Nominatim response; the library ignores numbers
      // for sun calculations.
      lat: String(at.lat) as unknown as number,
      lon: String(at.lng) as unknown as number,
      address: { country_code: "us", state: "" },
    });
    intervals = oh.getOpenIntervals(dayStart, dayEnd) as typeof intervals;
  } catch {
    return { open: null, reason: "Hours unknown" };
  }

  if (intervals.length === 0) return { open: false, reason: `Closed ${weekday}` };
  if (intervals.every(([, , unknown]) => unknown)) {
    return { open: null, reason: `Hours uncertain ${weekday}` };
  }

  if (SUN_RELATIVE.test(openingHours)) {
    return { open: true, reason: `Open daylight hours ${weekday}` };
  }

  const first = intervals[0][0];
  const last = intervals[intervals.length - 1][1];
  if (
    first.getTime() === dayStart.getTime() &&
    last.getTime() === dayEnd.getTime()
  ) {
    return { open: true, reason: `Open 24 hours ${weekday}` };
  }
  const spans = intervals
    .map(([from, to]) => {
      const end = to.getTime() === dayEnd.getTime() ? "24:00" : hhmm(to);
      return `${hhmm(from)}–${end}`;
    })
    .join(", ");
  return { open: true, reason: `Open ${spans} ${weekday}` };
}
