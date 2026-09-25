import { assertEquals } from "jsr:@std/assert@1";
import { categorizeOsm } from "./categories.ts";
import { buildOverpassQuery } from "./overpass-query.ts";
import { normalizeOverpass, normalizeTicketmaster } from "./normalize.ts";

Deno.test("categorizeOsm: brewpub counts as a brewery", () => {
  assertEquals(categorizeOsm({ amenity: "pub", craft: "brewery" }), "brewery");
  assertEquals(categorizeOsm({ amenity: "pub" }), "bar");
  assertEquals(categorizeOsm({ amenity: "ice_cream" }), "ice_cream");
  assertEquals(categorizeOsm({ shop: "ice_cream" }), "ice_cream");
  assertEquals(categorizeOsm({ tourism: "viewpoint" }), "viewpoint");
  assertEquals(categorizeOsm({ tourism: "attraction" }), "other");
  assertEquals(categorizeOsm({ historic: "mine" }), "historic");
  assertEquals(categorizeOsm({ historic: "no" }), null);
  assertEquals(categorizeOsm({ amenity: "parking" }), null);
});

Deno.test("normalizeOverpass: nodes and ways (center), skips unnamed/unknown", () => {
  const places = normalizeOverpass({
    elements: [
      {
        type: "node",
        id: 1,
        lat: 39.7,
        lon: -105.2,
        tags: {
          name: "Golden Brewing",
          craft: "brewery",
          opening_hours: "Mo-Su 11:00-21:00",
          "contact:website": "https://example.com",
          fixme: "noise",
        },
      },
      {
        type: "way",
        id: 2,
        center: { lat: 39.71, lon: -105.21 },
        tags: { name: "Lookout", tourism: "viewpoint" },
      },
      { type: "node", id: 3, lat: 1, lon: 1, tags: { amenity: "cafe" } },
      { type: "node", id: 4, lat: 1, lon: 1, tags: { name: "Lot", amenity: "parking" } },
      { type: "way", id: 5, tags: { name: "No coords", amenity: "cafe" } },
    ],
  });

  assertEquals(places.length, 2);
  assertEquals(places[0], {
    source: "osm",
    source_id: "node/1",
    name: "Golden Brewing",
    category: "brewery",
    lat: 39.7,
    lng: -105.2,
    website: "https://example.com",
    phone: null,
    opening_hours: "Mo-Su 11:00-21:00",
    tags: { craft: "brewery" },
  });
  assertEquals(places[1].source_id, "way/2");
  assertEquals(places[1].lat, 39.71);
});

Deno.test("normalizeOverpass tolerates empty or malformed input", () => {
  assertEquals(normalizeOverpass({}), []);
  assertEquals(normalizeOverpass(null), []);
});

Deno.test("normalizeTicketmaster maps venue, local date/time, and genre", () => {
  const events = normalizeTicketmaster({
    _embedded: {
      events: [
        {
          id: "tm1",
          name: "Bluegrass Night",
          url: "https://tm.example/tm1",
          dates: {
            start: {
              localDate: "2026-09-26",
              localTime: "19:30:00",
              dateTime: "2026-09-27T01:30:00Z",
            },
          },
          classifications: [{ segment: { name: "Music" }, genre: { name: "Folk" } }],
          _embedded: {
            venues: [{
              name: "Red Rocks",
              location: { latitude: "39.665", longitude: "-105.205" },
            }],
          },
        },
        {
          id: "tm2",
          name: "Date only",
          dates: { start: { localDate: "2026-09-26" } },
          classifications: [{ segment: { name: "Arts" }, genre: { name: "Undefined" } }],
        },
        { id: "tm3", name: "No date", dates: {} },
      ],
    },
  });

  assertEquals(events.length, 2);
  assertEquals(events[0].starts_at, "2026-09-27T01:30:00Z");
  assertEquals(events[0].local_date, "2026-09-26");
  assertEquals(events[0].category, "Folk");
  assertEquals(events[0].lat, 39.665);
  assertEquals(events[0].venue_name, "Red Rocks");
  assertEquals(events[1].category, "Arts");
  assertEquals(events[1].lat, null);
  assertEquals(events[1].starts_at, "2026-09-26T12:00:00Z");
});

Deno.test("buildOverpassQuery scales per-group radii with the trip radius", () => {
  const q = buildOverpassQuery({ lat: 39.65, lng: -105.25 }, 8000);
  assertEquals(q.includes('nwr["craft"="brewery"](around:8000,39.65,-105.25);'), true);
  assertEquals(q.includes("(around:4000,39.65,-105.25)"), true); // food group
  assertEquals(q.includes('nwr["historic"]["name"](around:5000,'), true);
  assertEquals(q.startsWith("[out:json][timeout:25];"), true);
});
