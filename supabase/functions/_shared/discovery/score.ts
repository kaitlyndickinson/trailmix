import { formatDistance } from "./geo.ts";
import type { Category, Scored } from "./types.ts";

/** Default weights until crews can set their own (Phase 4). */
export const DEFAULT_CATEGORY_WEIGHTS: Record<Category | "event", number> = {
  brewery: 1.5,
  viewpoint: 1.3,
  restaurant: 1.0,
  cafe: 1.0,
  ice_cream: 1.0,
  bar: 0.9,
  museum: 0.8,
  historic: 0.7,
  other: 0.5,
  event: 1.0,
};

export const OPEN_FACTOR = { open: 1.0, unknown: 0.6, closed: 0.1 };
export const EVENT_BONUS = 1.3;
const EDGE_DISTANCE_FACTOR = 0.3;

/** 1.0 at the trailhead, decaying linearly to 0.3 at the radius edge. */
export function distanceFactor(distanceM: number, radiusM: number): number {
  const t = Math.min(Math.max(distanceM / radiusM, 0), 1);
  return 1 - (1 - EDGE_DISTANCE_FACTOR) * t;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function scorePlace(input: {
  category: Category;
  distanceM: number;
  radiusM: number;
  hours: { open: boolean | null; reason: string } | null; // null = no trip date
  weights?: Record<string, number>;
}): Scored {
  const weights = input.weights ?? DEFAULT_CATEGORY_WEIGHTS;
  const weight = weights[input.category] ?? 1;
  const reasons = [formatDistance(input.distanceM)];

  let openFactor = 1;
  if (input.hours) {
    openFactor = input.hours.open === true
      ? OPEN_FACTOR.open
      : input.hours.open === false
      ? OPEN_FACTOR.closed
      : OPEN_FACTOR.unknown;
    reasons.push(input.hours.reason);
  }

  return {
    score: round(weight * distanceFactor(input.distanceM, input.radiusM) * openFactor),
    reasons,
  };
}

/** "19:30:00" → "7:30 PM". */
export function formatLocalTime(localTime: string): string {
  const [h, m] = localTime.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
}

export function scoreEvent(input: {
  distanceM: number | null;
  radiusM: number;
  onTripDate: boolean;
  localTime: string | null;
  weights?: Record<string, number>;
}): Scored {
  const weights = input.weights ?? DEFAULT_CATEGORY_WEIGHTS;
  const reasons: string[] = [];
  // Events come from a wider (25 mi) search, so clamp to the edge factor.
  const factor = input.distanceM == null
    ? EDGE_DISTANCE_FACTOR
    : distanceFactor(input.distanceM, input.radiusM);
  if (input.distanceM != null) reasons.push(formatDistance(input.distanceM));

  let bonus = 1;
  if (input.onTripDate) {
    bonus = EVENT_BONUS;
    reasons.push(
      input.localTime
        ? `Event at ${formatLocalTime(input.localTime)} on your hike day`
        : "Event on your hike day",
    );
  }

  return { score: round((weights.event ?? 1) * factor * bonus), reasons };
}
