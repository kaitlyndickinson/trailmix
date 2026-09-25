import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  areaCacheKey,
  boundingBox,
  formatDistance,
  geohash,
  haversineMeters,
} from "./geo.ts";

Deno.test("haversineMeters: Denver to Boulder is about 39 km", () => {
  const denver = { lat: 39.7392, lng: -104.9903 };
  const boulder = { lat: 40.015, lng: -105.2705 };
  assertAlmostEquals(haversineMeters(denver, boulder), 38_900, 500);
});

Deno.test("haversineMeters: same point is 0", () => {
  assertEquals(haversineMeters({ lat: 1, lng: 2 }, { lat: 1, lng: 2 }), 0);
});

Deno.test("formatDistance: miles with one decimal, trailhead under 0.1 mi", () => {
  assertEquals(formatDistance(1287), "0.8 mi from trailhead");
  assertEquals(formatDistance(50), "At the trailhead");
  assertEquals(formatDistance(20_000), "12 mi from trailhead");
});

Deno.test("boundingBox contains a point at the radius", () => {
  const center = { lat: 39.65, lng: -105.25 };
  const box = boundingBox(center, 16_000);
  // ~16 km north is inside; box is roughly symmetric.
  assertAlmostEquals(box.maxLat - center.lat, 0.1439, 0.001);
  assertAlmostEquals(center.lng - box.minLng, 0.1868, 0.002);
});

Deno.test("areaCacheKey rounds to ~1 km so nearby pins share a fetch", () => {
  assertEquals(
    areaCacheKey({ lat: 39.6512, lng: -105.2488 }, 16000),
    areaCacheKey({ lat: 39.6531, lng: -105.2461 }, 16000),
  );
  assertEquals(areaCacheKey({ lat: 39.6512, lng: -105.2488 }, 16000), "39.65,-105.25,16000");
});

Deno.test("geohash matches a known reference value", () => {
  // Reference: geohash of (57.64911, 10.40744) is "u4pruydqq".
  assertEquals(geohash({ lat: 57.64911, lng: 10.40744 }), "u4pruydqq");
  assertEquals(geohash({ lat: 39.7392, lng: -104.9903 }, 5), "9xj64");
});
