import { assertEquals } from "jsr:@std/assert@1";
import { dedupePlaces, normalizeName } from "./dedupe.ts";

Deno.test("normalizeName strips business-form noise and punctuation", () => {
  assertEquals(normalizeName("The Golden Brewing Co., LLC"), "golden");
  assertEquals(normalizeName("Golden Brewing Company"), "golden");
  assertEquals(normalizeName("Café Rio"), "cafe rio");
  assertEquals(normalizeName("Mountain Toad Brewing"), "mountain toad");
  assertEquals(normalizeName("Bob & Sue's"), "bob and sue s");
});

Deno.test("normalizeName never returns an empty string", () => {
  assertEquals(normalizeName("The Brewery"), "the brewery");
});

Deno.test("dedupePlaces merges same name within 75 m, keeping the richer entry", () => {
  const node = { name: "Golden Brewing Co", lat: 39.7555, lng: -105.2211, website: null };
  const way = {
    name: "Golden Brewing Company",
    lat: 39.7558, // ~33 m away
    lng: -105.2211,
    website: "https://goldenbrewing.example",
  };
  const { kept, collisions } = dedupePlaces([node, way]);
  assertEquals(collisions, 1);
  assertEquals(kept.length, 1);
  assertEquals(kept[0], way);
});

Deno.test("dedupePlaces keeps same name when far apart (chains)", () => {
  const a = { name: "Starbucks", lat: 39.7, lng: -105.2 };
  const b = { name: "Starbucks", lat: 39.71, lng: -105.2 }; // ~1.1 km
  assertEquals(dedupePlaces([a, b]).kept.length, 2);
});

Deno.test("dedupePlaces keeps different names at the same spot", () => {
  const a = { name: "Taco Place", lat: 39.7, lng: -105.2 };
  const b = { name: "Burger Place", lat: 39.7, lng: -105.2 };
  const { kept, collisions } = dedupePlaces([a, b]);
  assertEquals(kept.length, 2);
  assertEquals(collisions, 0);
});
