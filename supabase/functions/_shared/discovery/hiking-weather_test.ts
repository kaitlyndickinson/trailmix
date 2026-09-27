import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  buildDaySummary,
  classifyHour,
  findStormWindow,
  formatHour,
  hoursForDay,
  type OpenMeteoForecast,
} from "./hiking-weather.ts";

const DATE = "2026-09-26";

/** Builds an Open-Meteo-shaped forecast for DATE, hours 0–23, with overrides. */
function forecast(
  perHour: (hour: number) => Partial<Record<string, number>>,
  daily: Record<string, unknown> = {},
  elevationM = 3000,
): OpenMeteoForecast {
  const keys = [
    "temperature_2m", "apparent_temperature", "precipitation_probability",
    "precipitation", "snowfall", "weather_code", "wind_speed_10m",
    "wind_gusts_10m", "cloud_cover", "uv_index", "cape",
    "freezing_level_height", "visibility", "is_day",
  ];
  const hourly: Record<string, unknown[]> = { time: [] };
  for (const k of keys) hourly[k] = [];
  for (let h = 0; h < 24; h++) {
    hourly.time.push(`${DATE}T${String(h).padStart(2, "0")}:00`);
    const base: Record<string, number> = {
      temperature_2m: 50, apparent_temperature: 48, precipitation_probability: 5,
      precipitation: 0, snowfall: 0, weather_code: 1, wind_speed_10m: 8,
      wind_gusts_10m: 15, cloud_cover: 20, uv_index: 3, cape: 100,
      freezing_level_height: 14000, visibility: 60000, is_day: h >= 7 && h < 19 ? 1 : 0,
      ...perHour(h),
    };
    for (const k of keys) hourly[k].push(base[k]);
  }
  return {
    timezone: "America/Denver",
    utc_offset_seconds: -21600,
    elevation: elevationM,
    hourly,
    daily: {
      time: [DATE],
      temperature_2m_max: [58.4], temperature_2m_min: [39.6],
      apparent_temperature_max: [55], apparent_temperature_min: [35],
      precipitation_probability_max: [70], precipitation_sum: [0.31],
      snowfall_sum: [0], weather_code: [95], wind_gusts_10m_max: [30],
      uv_index_max: [7.6], sunrise: [`${DATE}T06:52`], sunset: [`${DATE}T18:51`],
      daylight_duration: [43100],
      ...daily,
    },
  };
}

Deno.test("formatHour", () => {
  assertEquals(formatHour("13:00"), "1 PM");
  assertEquals(formatHour("00:00"), "12 AM");
  assertEquals(formatHour("12:30"), "12:30 PM");
});

Deno.test("classifyHour: thunder codes, CAPE-driven storms, and likely precip", () => {
  assertEquals(classifyHour({ code: 95, pop: 10, cape: 0 }), "thunder");
  assertEquals(classifyHour({ code: 80, pop: 35, cape: 1400 }), "thunder");
  assertEquals(classifyHour({ code: 3, pop: 25, cape: 1400 }), null); // fuel, little chance
  assertEquals(classifyHour({ code: 3, pop: 45, cape: 200 }), "precip");
  assertEquals(classifyHour({ code: 61, pop: 20, cape: 0 }), "precip");
  assertEquals(classifyHour({ code: 2, pop: 10, cape: 0 }), null);
});

Deno.test("hoursForDay keeps 5 AM–9 PM for the date, with units and risk", () => {
  const hours = hoursForDay(forecast(() => ({})).hourly, DATE);
  assertEquals(hours.length, 17);
  assertEquals(hours[0].time, "05:00");
  assertEquals(hours.at(-1)!.time, "21:00");
  assertEquals(hours[0].icon, "🌙"); // before sunrise, mostly clear
  assertEquals(hours[5].icon, "🌤️"); // 10 AM
});

Deno.test("afternoon thunderstorms: window, start early, and a 'below treeline by' time", () => {
  const f = forecast((h) =>
    h >= 13 && h <= 16
      ? { weather_code: h === 14 ? 95 : 80, precipitation_probability: h === 14 ? 70 : 45, cape: 1300 }
      : {}
  );
  const s = buildDaySummary(f, DATE)!;
  assertEquals(s.storm_window, {
    start: "13:00",
    end: "17:00",
    kind: "thunder",
    precip_type: "rain",
    peak_pop: 70,
  });
  assertEquals(s.start_early, true);
  assertEquals(s.flags[0], {
    level: "danger",
    kind: "thunder",
    text: "Thunderstorms likely 1 PM–5 PM (up to 70%). Start early and be below treeline by 12 PM.",
  });
});

Deno.test("morning thunderstorms: no 'start early', suggests another day", () => {
  const f = forecast((h) => (h >= 8 && h <= 10 ? { weather_code: 95, precipitation_probability: 60 } : {}));
  const s = buildDaySummary(f, DATE)!;
  assertEquals(s.start_early, false);
  assert(s.flags[0].text.startsWith("Thunderstorms possible from 8 AM (up to 60%)."));
});

Deno.test("clear, mild day: no window and only the UV flag", () => {
  const s = buildDaySummary(forecast((h) => ({ uv_index: h === 12 ? 6.4 : 3 })), DATE)!;
  assertEquals(s.storm_window, null);
  assertEquals(s.start_early, false);
  assertEquals(s.flags.map((f) => f.kind), ["uv"]);
  assertEquals(
    s.flags[0].text,
    "UV 6 (high) around 12 PM. Sunscreen and sunglasses; UV is stronger at altitude.",
  );
});

Deno.test("snowy whiteout at altitude (modeled on Mt. Bierstadt, Sep 28)", () => {
  const f = forecast(
    (h) => ({
      temperature_2m: 32, apparent_temperature: h === 18 ? 17.7 : 22,
      wind_gusts_10m: h === 17 ? 27.5 : 20,
      freezing_level_height: 13500,
      ...(h >= 14 && h <= 18
        ? { weather_code: 73, precipitation_probability: 60, snowfall: 0.6, visibility: h === 15 ? 0 : 328 }
        : {}),
    }),
    { snowfall_sum: [2.84], weather_code: [75] },
    4240, // 13,911 ft
  );
  const s = buildDaySummary(f, DATE)!;
  assertEquals(s.elevation_ft, 13911);
  assertEquals(s.storm_window?.kind, "precip");
  assertEquals(s.storm_window?.precip_type, "snow");
  assertEquals(s.conditions, "Heavy snow");
  const byKind = Object.fromEntries(s.flags.map((f) => [f.kind, f]));
  assertEquals(byKind.precip.text, "Snow likely 2 PM–7 PM (up to 60%).");
  assertEquals(byKind.snow.level, "warn");
  assertEquals(
    byKind.visibility.text,
    "Visibility drops to under 0.1 mi 2 PM–7 PM. Whiteout or fog risk; know the route or turn back.",
  );
  // 17.7°F rounds to 18 in the hourly data.
  assertEquals(byKind.cold.text, "Feels like 18°F around 6 PM. Insulated layer, gloves, and a hat.");
  assertEquals(byKind.wind.level, "info");
  assertEquals(
    byKind.freezing.text,
    "Freezing level dips to 13,500 ft, below this point (13,900 ft). Expect ice on the trail.",
  );
  // Most serious first.
  assertEquals(s.flags.map((f) => f.level), [...s.flags.map((f) => f.level)].sort((a, b) =>
    ["danger", "warn", "info"].indexOf(a) - ["danger", "warn", "info"].indexOf(b)
  ));
});

Deno.test("dangerous wind and cold", () => {
  const s = buildDaySummary(
    forecast((h) => ({ wind_gusts_10m: h === 11 ? 58 : 30, apparent_temperature: h === 6 ? -4 : 20 })),
    DATE,
  )!;
  const byKind = Object.fromEntries(s.flags.map((f) => [f.kind, f]));
  assertEquals(byKind.wind.text, "Gusts to 58 mph around 11 AM. Dangerous above treeline.");
  assertEquals(byKind.cold.text, "Feels like −4°F around 6 AM. Frostbite risk on exposed skin.");
  assertEquals(s.flags.slice(0, 2).every((f) => f.level === "danger"), true);
});

Deno.test("findStormWindow ignores risky hours outside hiking hours", () => {
  const hours = hoursForDay(
    forecast((h) => (h === 21 ? { weather_code: 95, precipitation_probability: 80 } : {})).hourly,
    DATE,
  );
  assertEquals(findStormWindow(hours), null);
});

Deno.test("buildDaySummary returns null for a date outside the forecast", () => {
  assertEquals(buildDaySummary(forecast(() => ({})), "2026-09-27"), null);
});
