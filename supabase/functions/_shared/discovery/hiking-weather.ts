// Turns an Open-Meteo forecast into what a hiker needs for one day: an hourly
// strip, the storm window, a "start early" call, and plain-language flags.
// Pure and deterministic: every threshold is a named constant below.

import { describeWeatherCode } from "./weather.ts";

// ---- Thresholds ------------------------------------------------------------

/** Hours considered "on the trail" for windows and daytime extremes. */
export const HIKING_HOURS = { from: 5, to: 20 } as const; // 5 AM–8 PM, inclusive
/** Hours shown in the hourly strip. */
export const STRIP_HOURS = { from: 5, to: 21 } as const;

/** Chance of precipitation that counts as "likely". */
export const POP_LIKELY = 40;
/**
 * CAPE (J/kg) is the fuel for thunderstorms. ~1000+ is moderate instability;
 * with a real chance of precipitation it means convective storms are likely
 * even when the model's weather code only says "showers".
 */
export const CAPE_STORM = 1000;
export const POP_WITH_CAPE = 30;
/** Storms starting at or after this hour are the classic afternoon build-up. */
export const START_EARLY_FROM_HOUR = 11;

export const GUST = { info: 25, warn: 35, danger: 50 } as const; // mph
export const FEELS_COLD = { info: 32, warn: 20, danger: 0 } as const; // °F
export const FEELS_HOT = { info: 80, warn: 90 } as const; // °F
export const UV = { info: 6, warn: 8 } as const;
export const LOW_VISIBILITY_FT = 2640; // half a mile
export const SNOW_FLAG_IN = 0.1;

const THUNDER_CODES = new Set([95, 96, 99]);
const PRECIP_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FT_PER_M = 3.28084;

// ---- Types -----------------------------------------------------------------

export type HourRisk = "thunder" | "precip" | null;

export type HourPoint = {
  time: string; // "13:00", trailhead-local
  hour: number;
  icon: string;
  code: number | null;
  conditions: string | null;
  temp_f: number | null;
  feels_f: number | null;
  pop: number | null; // %
  precip_in: number | null;
  snow_in: number | null;
  wind_mph: number | null;
  gust_mph: number | null;
  cloud_pct: number | null;
  uv: number | null;
  cape: number | null;
  freezing_level_ft: number | null;
  visibility_ft: number | null;
  risk: HourRisk;
};

export type StormWindow = {
  start: string; // "13:00"
  end: string; // "17:00" (end of the last risky hour)
  kind: "thunder" | "precip";
  precip_type: "rain" | "snow" | "mixed";
  peak_pop: number | null;
};

export type WeatherFlag = {
  level: "danger" | "warn" | "info";
  kind: string;
  text: string;
};

export type OpenMeteoForecast = {
  timezone?: string;
  utc_offset_seconds?: number;
  elevation?: number; // meters
  daily?: Record<string, unknown[]>;
  hourly?: Record<string, unknown[]>;
};

export type DaySummary = {
  date: string;
  timezone: string | null;
  elevation_ft: number | null;
  conditions: string | null;
  icon: string;
  high_f: number | null;
  low_f: number | null;
  feels_high_f: number | null;
  feels_low_f: number | null;
  precip_max_pct: number | null;
  precip_in: number | null;
  snow_in: number | null;
  gust_max_mph: number | null;
  uv_max: number | null;
  sunrise: string | null; // "06:52"
  sunset: string | null;
  daylight_hours: number | null;
  freezing_level_min_ft: number | null;
  storm_window: StormWindow | null;
  start_early: boolean;
  flags: WeatherFlag[];
  hours: HourPoint[];
};

// ---- Helpers ---------------------------------------------------------------

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const round = (n: number | null, digits = 0): number | null =>
  n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits;

/** "13:00" → "1 PM"; "12:30" → "12:30 PM". */
export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function weatherIcon(code: number | null, isDay = true): string {
  if (code == null) return "·";
  if (THUNDER_CODES.has(code)) return "⛈️";
  if (SNOW_CODES.has(code)) return "🌨️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code === 45 || code === 48) return "🌫️";
  if (code === 3) return "☁️";
  if (code === 2) return isDay ? "⛅" : "☁️";
  if (code === 1) return isDay ? "🌤️" : "🌙";
  return isDay ? "☀️" : "🌙";
}

export function classifyHour(h: {
  code: number | null;
  pop: number | null;
  cape: number | null;
}): HourRisk {
  if (h.code != null && THUNDER_CODES.has(h.code)) return "thunder";
  if ((h.cape ?? 0) >= CAPE_STORM && (h.pop ?? 0) >= POP_WITH_CAPE) return "thunder";
  if ((h.pop ?? 0) >= POP_LIKELY) return "precip";
  if (h.code != null && PRECIP_CODES.has(h.code)) return "precip";
  return null;
}

// ---- Hourly ----------------------------------------------------------------

/** Hourly points for `date` (trailhead-local), within STRIP_HOURS. */
export function hoursForDay(
  hourly: Record<string, unknown[]> | undefined,
  date: string,
): HourPoint[] {
  const times = (hourly?.time ?? []) as string[];
  const col = (key: string, i: number) => num(hourly?.[key]?.[i]);
  const out: HourPoint[] = [];

  times.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const hour = Number(t.slice(11, 13));
    if (hour < STRIP_HOURS.from || hour > STRIP_HOURS.to) return;
    const code = col("weather_code", i);
    const pop = col("precipitation_probability", i);
    const cape = col("cape", i);
    const isDay = col("is_day", i);
    out.push({
      time: hourLabel(hour),
      hour,
      icon: weatherIcon(code, isDay == null ? hour >= 7 && hour < 19 : isDay === 1),
      code,
      conditions: describeWeatherCode(code),
      temp_f: round(col("temperature_2m", i)),
      feels_f: round(col("apparent_temperature", i)),
      pop,
      precip_in: round(col("precipitation", i), 2),
      snow_in: round(col("snowfall", i), 2),
      wind_mph: round(col("wind_speed_10m", i)),
      gust_mph: round(col("wind_gusts_10m", i)),
      cloud_pct: col("cloud_cover", i),
      uv: round(col("uv_index", i), 1),
      cape: round(cape),
      freezing_level_ft: round(col("freezing_level_height", i), -2),
      visibility_ft: round(col("visibility", i)),
      risk: classifyHour({ code, pop, cape }),
    });
  });
  return out;
}

const onTrail = (h: HourPoint) =>
  h.hour >= HIKING_HOURS.from && h.hour <= HIKING_HOURS.to;

const isSnowy = (h: HourPoint) =>
  (h.code != null && SNOW_CODES.has(h.code)) || (h.snow_in ?? 0) > 0;

/** First to last risky hour during hiking hours. */
export function findStormWindow(hours: HourPoint[]): StormWindow | null {
  const risky = hours.filter((h) => onTrail(h) && h.risk);
  if (risky.length === 0) return null;
  const first = risky[0];
  const last = risky[risky.length - 1];
  const snowy = risky.filter(isSnowy).length;
  const pops = risky.map((h) => h.pop).filter((p): p is number => p != null);
  return {
    start: first.time,
    end: hourLabel(last.hour + 1),
    kind: risky.some((h) => h.risk === "thunder") ? "thunder" : "precip",
    precip_type: snowy === 0 ? "rain" : snowy === risky.length ? "snow" : "mixed",
    peak_pop: pops.length ? Math.max(...pops) : null,
  };
}

// ---- Flags -----------------------------------------------------------------

const fmtF = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n)}°F`;
const fmtFt = (n: number) => `${(Math.round(n / 100) * 100).toLocaleString("en-US")} ft`;
const fmtMi = (ft: number) => {
  const mi = ft / 5280;
  return mi < 0.1 ? "under 0.1 mi" : `${mi.toFixed(1)} mi`;
};

function extreme(
  hours: HourPoint[],
  pick: (h: HourPoint) => number | null,
  mode: "min" | "max",
): { value: number; at: HourPoint } | null {
  let best: { value: number; at: HourPoint } | null = null;
  for (const h of hours) {
    const v = pick(h);
    if (v == null) continue;
    if (!best || (mode === "min" ? v < best.value : v > best.value)) {
      best = { value: v, at: h };
    }
  }
  return best;
}

function span(from: HourPoint, to: HourPoint): string {
  return `${formatHour(from.time)}–${formatHour(hourLabel(to.hour + 1))}`;
}

/**
 * Plain-language flags, most serious first. Each says what, when, and what to
 * do about it, so the card is useful at a glance.
 */
export function hikerFlags(
  hours: HourPoint[],
  window: StormWindow | null,
  day: { snow_in: number | null; elevation_ft: number | null },
): WeatherFlag[] {
  const trail = hours.filter(onTrail);
  const flags: WeatherFlag[] = [];

  if (window) {
    const when = `${formatHour(window.start)}–${formatHour(window.end)}`;
    const pop = window.peak_pop != null ? ` (up to ${window.peak_pop}%)` : "";
    const startHour = Number(window.start.slice(0, 2));
    if (window.kind === "thunder" && startHour >= START_EARLY_FROM_HOUR) {
      const below = formatHour(hourLabel(Math.max(startHour - 1, HIKING_HOURS.from)));
      flags.push({
        level: "danger",
        kind: "thunder",
        text: `Thunderstorms likely ${when}${pop}. Start early and be below treeline by ${below}.`,
      });
    } else if (window.kind === "thunder") {
      flags.push({
        level: "danger",
        kind: "thunder",
        text: `Thunderstorms possible from ${formatHour(window.start)}${pop}. Exposed ridges and summits are risky; consider another day.`,
      });
    } else {
      const what = window.precip_type === "snow"
        ? "Snow"
        : window.precip_type === "mixed"
        ? "Rain and snow"
        : "Rain";
      flags.push({ level: "warn", kind: "precip", text: `${what} likely ${when}${pop}.` });
    }
  }

  if ((day.snow_in ?? 0) >= SNOW_FLAG_IN) {
    flags.push({
      level: "warn",
      kind: "snow",
      text: `${day.snow_in} in of new snow expected. Traction (microspikes) and waterproof boots recommended.`,
    });
  }

  const lowVis = trail.filter((h) => (h.visibility_ft ?? Infinity) < LOW_VISIBILITY_FT);
  if (lowVis.length > 0) {
    const worst = extreme(lowVis, (h) => h.visibility_ft, "min")!;
    flags.push({
      level: "warn",
      kind: "visibility",
      text: `Visibility drops to ${fmtMi(worst.value)} ${span(lowVis[0], lowVis[lowVis.length - 1])}. Whiteout or fog risk; know the route or turn back.`,
    });
  }

  const gust = extreme(trail, (h) => h.gust_mph, "max");
  if (gust && gust.value >= GUST.info) {
    const when = formatHour(gust.at.time);
    if (gust.value >= GUST.danger) {
      flags.push({
        level: "danger",
        kind: "wind",
        text: `Gusts to ${gust.value} mph around ${when}. Dangerous above treeline.`,
      });
    } else if (gust.value >= GUST.warn) {
      flags.push({
        level: "warn",
        kind: "wind",
        text: `Gusts to ${gust.value} mph around ${when}. Strong wind above treeline; bring a shell.`,
      });
    } else {
      flags.push({
        level: "info",
        kind: "wind",
        text: `Breezy: gusts to ${gust.value} mph around ${when}.`,
      });
    }
  }

  const cold = extreme(trail, (h) => h.feels_f, "min");
  if (cold && cold.value <= FEELS_COLD.info) {
    const when = formatHour(cold.at.time);
    if (cold.value <= FEELS_COLD.danger) {
      flags.push({
        level: "danger",
        kind: "cold",
        text: `Feels like ${fmtF(cold.value)} around ${when}. Frostbite risk on exposed skin.`,
      });
    } else if (cold.value <= FEELS_COLD.warn) {
      flags.push({
        level: "warn",
        kind: "cold",
        text: `Feels like ${fmtF(cold.value)} around ${when}. Insulated layer, gloves, and a hat.`,
      });
    } else {
      flags.push({
        level: "info",
        kind: "cold",
        text: `Below-freezing wind chill: feels like ${fmtF(cold.value)} around ${when}.`,
      });
    }
  }

  const hot = extreme(trail, (h) => h.feels_f, "max");
  if (hot && hot.value >= FEELS_HOT.info) {
    flags.push({
      level: hot.value >= FEELS_HOT.warn ? "warn" : "info",
      kind: "heat",
      text: `Feels like ${fmtF(hot.value)} around ${formatHour(hot.at.time)}. Extra water and shade breaks.`,
    });
  }

  const uv = extreme(trail, (h) => h.uv, "max");
  if (uv && uv.value >= UV.info) {
    const label = uv.value >= 11 ? "extreme" : uv.value >= UV.warn ? "very high" : "high";
    flags.push({
      level: uv.value >= UV.warn ? "warn" : "info",
      kind: "uv",
      text: `UV ${Math.round(uv.value)} (${label}) around ${formatHour(uv.at.time)}. Sunscreen and sunglasses; UV is stronger at altitude.`,
    });
  }

  const freezing = extreme(trail, (h) => h.freezing_level_ft, "min");
  if (freezing && day.elevation_ft != null && freezing.value < day.elevation_ft) {
    flags.push({
      level: "warn",
      kind: "freezing",
      text: `Freezing level dips to ${fmtFt(freezing.value)}, below this point (${fmtFt(day.elevation_ft)}). Expect ice on the trail.`,
    });
  }

  const order = { danger: 0, warn: 1, info: 2 } as const;
  return flags.sort((a, b) => order[a.level] - order[b.level]);
}

// ---- Day summary -----------------------------------------------------------

export function buildDaySummary(
  forecast: OpenMeteoForecast,
  date: string,
): DaySummary | null {
  const daily = forecast.daily ?? {};
  const i = ((daily.time ?? []) as string[]).indexOf(date);
  if (i < 0) return null;
  const d = (key: string) => num(daily[key]?.[i]);
  const time = (key: string) => {
    const v = daily[key]?.[i];
    return typeof v === "string" ? v.slice(11, 16) : null;
  };

  const hours = hoursForDay(forecast.hourly, date);
  const window = findStormWindow(hours);
  const elevationFt = forecast.elevation != null
    ? Math.round(forecast.elevation * FT_PER_M)
    : null;
  const snowIn = round(d("snowfall_sum"), 1);
  const freezing = extreme(hours.filter(onTrail), (h) => h.freezing_level_ft, "min");
  const code = d("weather_code");
  const daylight = d("daylight_duration");

  return {
    date,
    timezone: forecast.timezone ?? null,
    elevation_ft: elevationFt,
    conditions: describeWeatherCode(code),
    icon: weatherIcon(code),
    high_f: round(d("temperature_2m_max")),
    low_f: round(d("temperature_2m_min")),
    feels_high_f: round(d("apparent_temperature_max")),
    feels_low_f: round(d("apparent_temperature_min")),
    precip_max_pct: d("precipitation_probability_max"),
    precip_in: round(d("precipitation_sum"), 2),
    snow_in: snowIn,
    gust_max_mph: round(d("wind_gusts_10m_max")),
    uv_max: round(d("uv_index_max"), 1),
    sunrise: time("sunrise"),
    sunset: time("sunset"),
    daylight_hours: daylight == null ? null : round(daylight / 3600, 1),
    freezing_level_min_ft: freezing ? freezing.value : null,
    storm_window: window,
    start_early: window?.kind === "thunder" &&
      Number(window.start.slice(0, 2)) >= START_EARLY_FROM_HOUR,
    flags: hikerFlags(hours, window, { snow_in: snowIn, elevation_ft: elevationFt }),
    hours,
  };
}
