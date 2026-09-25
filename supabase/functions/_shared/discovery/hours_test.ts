import { assertEquals } from "jsr:@std/assert@1";
import { hoursOnDate } from "./hours.ts";

const GOLDEN = { lat: 39.7555, lng: -105.2211 };
const SATURDAY = "2026-09-26";
const MONDAY = "2026-09-28";

Deno.test("hoursOnDate: open with the day's hours", () => {
  assertEquals(
    hoursOnDate("Mo-Fr 11:00-21:00; Sa 10:00-22:00", SATURDAY, GOLDEN),
    { open: true, reason: "Open 10:00–22:00 Sat" },
  );
});

Deno.test("hoursOnDate: closed that weekday", () => {
  assertEquals(hoursOnDate("Tu-Su 11:00-21:00", MONDAY, GOLDEN), {
    open: false,
    reason: "Closed Mon",
  });
});

Deno.test("hoursOnDate: split hours and past-midnight close", () => {
  assertEquals(
    hoursOnDate("Sa 11:00-14:00,17:00-24:00", SATURDAY, GOLDEN),
    { open: true, reason: "Open 11:00–14:00, 17:00–24:00 Sat" },
  );
});

Deno.test("hoursOnDate: 24/7", () => {
  assertEquals(hoursOnDate("24/7", SATURDAY, GOLDEN), {
    open: true,
    reason: "Open 24 hours Sat",
  });
});

Deno.test("hoursOnDate: missing or unparseable hours are unknown", () => {
  assertEquals(hoursOnDate(null, SATURDAY, GOLDEN), {
    open: null,
    reason: "Hours unknown",
  });
  assertEquals(hoursOnDate("ask the bartender", SATURDAY, GOLDEN), {
    open: null,
    reason: "Hours unknown",
  });
});

Deno.test("hoursOnDate: explicitly unknown ranges stay unknown", () => {
  assertEquals(hoursOnDate("Sa 10:00-14:00 unknown", SATURDAY, GOLDEN), {
    open: null,
    reason: "Hours uncertain Sat",
  });
});
