import { assertEquals } from "jsr:@std/assert@1";
import {
  daysUntil,
  describeWeatherCode,
  isInForecastWindow,
} from "./weather.ts";

Deno.test("daysUntil and the 16-day forecast window", () => {
  assertEquals(daysUntil("2026-09-26", "2026-09-25"), 1);
  assertEquals(daysUntil("2026-10-01", "2026-09-25"), 6);
  assertEquals(isInForecastWindow("2026-09-25", "2026-09-25"), true);
  assertEquals(isInForecastWindow("2026-10-10", "2026-09-25"), true); // day 15
  assertEquals(isInForecastWindow("2026-10-11", "2026-09-25"), false); // day 16
  assertEquals(isInForecastWindow("2026-09-24", "2026-09-25"), true); // UTC slack
  assertEquals(isInForecastWindow("2026-09-23", "2026-09-25"), false);
});

Deno.test("describeWeatherCode", () => {
  assertEquals(describeWeatherCode(95), "Thunderstorms");
  assertEquals(describeWeatherCode(0), "Clear");
  assertEquals(describeWeatherCode(1234), null);
  assertEquals(describeWeatherCode(null), null);
});
