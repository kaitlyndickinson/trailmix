"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so it only ever loads in the browser.
export const TrailheadMap = dynamic(() => import("./trailhead-map"), {
  ssr: false,
  loading: () => (
    <div className="bg-sand h-64 w-full animate-pulse rounded-xl" />
  ),
});

export type { LatLng } from "./trailhead-map";
