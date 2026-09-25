import type { Category } from "./types.ts";

const AMENITY: Record<string, Category> = {
  restaurant: "restaurant",
  cafe: "cafe",
  pub: "bar",
  bar: "bar",
  biergarten: "bar",
  ice_cream: "ice_cream",
};

const TOURISM: Record<string, Category> = {
  viewpoint: "viewpoint",
  museum: "museum",
  attraction: "other",
};

/** Maps raw OSM tags to one normalized category, or null if we don't use it. */
export function categorizeOsm(tags: Record<string, string>): Category | null {
  // A brewpub is tagged amenity=pub + craft=brewery; the brewery wins.
  if (tags.craft === "brewery" || tags.microbrewery === "yes") return "brewery";
  if (tags.amenity && AMENITY[tags.amenity]) return AMENITY[tags.amenity];
  if (tags.shop === "ice_cream") return "ice_cream";
  if (tags.tourism && TOURISM[tags.tourism]) return TOURISM[tags.tourism];
  if (tags.historic && tags.historic !== "no") return "historic";
  return null;
}
