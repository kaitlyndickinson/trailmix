import { assertEquals } from "jsr:@std/assert@1";
import {
  distanceFactor,
  formatLocalTime,
  scoreEvent,
  scorePlace,
} from "./score.ts";
import { topPerCategory } from "./select.ts";

Deno.test("distanceFactor: 1.0 at the trailhead, 0.3 at the edge, clamped", () => {
  assertEquals(distanceFactor(0, 16000), 1);
  assertEquals(distanceFactor(16000, 16000), 0.30000000000000004);
  assertEquals(distanceFactor(8000, 16000), 0.65);
  assertEquals(distanceFactor(40000, 16000), 0.30000000000000004);
});

Deno.test("scorePlace: open brewery near the trailhead", () => {
  assertEquals(
    scorePlace({
      category: "brewery",
      distanceM: 0,
      radiusM: 16000,
      hours: { open: true, reason: "Open 11:00–21:00 Sat" },
    }),
    { score: 1.5, reasons: ["At the trailhead", "Open 11:00–21:00 Sat"] },
  );
});

Deno.test("scorePlace: closed places sink, unknown hours sit in between", () => {
  const base = { category: "restaurant" as const, distanceM: 0, radiusM: 16000 };
  const open = scorePlace({ ...base, hours: { open: true, reason: "" } }).score;
  const unknown = scorePlace({ ...base, hours: { open: null, reason: "" } }).score;
  const closed = scorePlace({ ...base, hours: { open: false, reason: "" } }).score;
  assertEquals([open, unknown, closed], [1, 0.6, 0.1]);
});

Deno.test("scorePlace: no trip date means no hours factor or reason", () => {
  assertEquals(
    scorePlace({ category: "cafe", distanceM: 8000, radiusM: 16000, hours: null }),
    { score: 0.65, reasons: ["5.0 mi from trailhead"] },
  );
});

Deno.test("scorePlace: custom weights override defaults", () => {
  const s = scorePlace({
    category: "museum",
    distanceM: 0,
    radiusM: 16000,
    hours: null,
    weights: { museum: 2 },
  });
  assertEquals(s.score, 2);
});

Deno.test("scoreEvent: hike-day bonus and a readable time", () => {
  assertEquals(
    scoreEvent({ distanceM: 0, radiusM: 16000, onTripDate: true, localTime: "19:30:00" }),
    { score: 1.3, reasons: ["At the trailhead", "Event at 7:30 PM on your hike day"] },
  );
  assertEquals(
    scoreEvent({ distanceM: null, radiusM: 16000, onTripDate: false, localTime: null }),
    { score: 0.3, reasons: [] },
  );
});

Deno.test("formatLocalTime", () => {
  assertEquals(formatLocalTime("00:00:00"), "12 AM");
  assertEquals(formatLocalTime("12:15:00"), "12:15 PM");
  assertEquals(formatLocalTime("21:00:00"), "9 PM");
});

Deno.test("topPerCategory keeps the best n per category, ties by name", () => {
  const items = [
    { category: "bar", score: 0.5, name: "B" },
    { category: "bar", score: 0.9, name: "A" },
    { category: "bar", score: 0.5, name: "A2" },
    { category: "cafe", score: 0.1, name: "C" },
  ];
  assertEquals(
    topPerCategory(items, 2).map((i) => i.name),
    ["A", "A2", "C"],
  );
});
