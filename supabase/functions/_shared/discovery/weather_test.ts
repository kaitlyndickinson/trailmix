import { assertEquals } from "jsr:@std/assert@1";
import {
  daysUntil,
  describeWeatherCode,
  isInForecastWindow,
  summarizeWeather,
} from "./weather.ts";

Deno.test("daysUntil and the 16-day forecast window", () => {
  assertEquals(daysUntil("2026-09-26", "2026-09-25"), 1);
  assertEquals(daysUntil("2026-10-01", "2026-09-25"), 6);
  assertEquals(isInForecastWindow("2026-09-25", "2026-09-25"), true);
  assertEquals(isInForecastWindow("2026-10-10", "2026-09-25"), true); // day 15
  assertEquals(isInForecastWindow("2026-10-11", "2026-09-25"), false); // day 16
  assertEquals(isInForecastWindow("2026-09-24", "2026-09-25"), false);
});

Deno.test("describeWeatherCode", () => {
  assertEquals(describeWeatherCode(95), "Thunderstorms");
  assertEquals(describeWeatherCode(0), "Clear");
  assertEquals(describeWeatherCode(1234), null);
  assertEquals(describeWeatherCode(null), null);
});

Deno.test("summarizeWeather picks the trip date's row", () => {
  const daily = {
    time: ["2026-09-26"],
    temperature_2m_max: [71.6],
    temperature_2m_min: [44.2],
    precipitation_probability_max: [40],
    weather_code: [95],
    sunrise: ["2026-09-26T06:52"],
    sunset: ["2026-09-26T18:51"],
  };
  assertEquals(summarizeWeather(daily, "2026-09-26"), {
    date: "2026-09-26",
    conditions: "Thunderstorms",
    high_f: 72,
    low_f: 44,
    precip_max_pct: 40,
    sunrise: "06:52",
    sunset: "18:51",
  });
  assertEquals(summarizeWeather(daily, "2026-09-27"), null);
});
