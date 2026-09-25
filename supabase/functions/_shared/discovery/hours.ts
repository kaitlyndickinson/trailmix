import OpeningHours from "npm:opening_hours@3.15.0";
import type { LatLng } from "./types.ts";

export type HoursResult = {
  open: boolean | null; // null = unknown
  reason: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
      lat: at.lat,
      lon: at.lng,
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
