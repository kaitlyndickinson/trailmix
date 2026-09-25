import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trailmix",
    short_name: "Trailmix",
    description: "Plan hikes together: trips, checklists, and what's nearby.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#2f5d3a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
