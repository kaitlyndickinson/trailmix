"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// Leaflet touches `window` on import, so it only ever loads in the browser.
const LazyMap = dynamic(() => import("./trailhead-map"), {
  ssr: false,
  loading: () => null,
});

/** Sized wrapper, so the placeholder and the map always share one height. */
export function TrailheadMap({
  className = "h-64",
  ...props
}: ComponentProps<typeof LazyMap>) {
  return (
    <div className={`${className} bg-sand w-full rounded-xl`}>
      <LazyMap {...props} className="h-full" />
    </div>
  );
}

export type { LatLng } from "./trailhead-map";
