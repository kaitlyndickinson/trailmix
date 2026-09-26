"use server";

import { searchPlaces, type PlaceResult } from "@/lib/clients/photon";
import { resolveMapsShareLink } from "@/lib/clients/google-maps";
import { isMapsShortLink, type Coords } from "@/lib/maps-link";
import { requireUser } from "@/lib/supabase/server";

// Colorado Front Range, used to bias search when there's no pin yet.
const DEFAULT_NEAR = { lat: 39.65, lng: -105.25 };

export async function searchTrailheads(
  query: string,
  near: Coords | null,
): Promise<{ results?: PlaceResult[]; error?: string }> {
  await requireUser();
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return { error: "Type a trail, peak, or trailhead name." };
  try {
    return { results: await searchPlaces(q, near ?? DEFAULT_NEAR) };
  } catch {
    return {
      error: "Search isn't responding right now. Try again in a moment.",
    };
  }
}

export async function resolveMapsLink(
  link: string,
): Promise<{ coords?: Coords; error?: string }> {
  await requireUser();
  if (!isMapsShortLink(link)) {
    return { error: "That doesn't look like a Google Maps share link." };
  }
  try {
    const coords = await resolveMapsShareLink(link);
    return coords
      ? { coords }
      : {
          error:
            "Couldn't find a location in that link. Try dropping a pin instead.",
        };
  } catch {
    return {
      error: "Couldn't open that link right now. Try again in a moment.",
    };
  }
}
