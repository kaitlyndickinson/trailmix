export const FORECAST_WINDOW_DAYS = 16;

/** Whole days from `today` to `tripDate` (both YYYY-MM-DD). */
export function daysUntil(tripDate: string, today: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(tripDate) - toUtc(today)) / 86_400_000);
}

export function isInForecastWindow(tripDate: string, today: string): boolean {
  const days = daysUntil(tripDate, today);
  return days >= 0 && days < FORECAST_WINDOW_DAYS;
}

// WMO weather codes used by Open-Meteo.
const WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorms",
  96: "Thunderstorms with hail",
  99: "Thunderstorms with hail",
};

export function describeWeatherCode(code: number | null | undefined): string | null {
  if (code == null) return null;
  return WEATHER_CODES[code] ?? null;
}

type OpenMeteoDaily = {
  time?: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  weather_code?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
};

export type WeatherSummary = {
  date: string;
  conditions: string | null;
  high_f: number | null;
  low_f: number | null;
  precip_max_pct: number | null;
  sunrise: string | null; // local "HH:MM"
  sunset: string | null;
};

/** Pulls the trip date's row out of Open-Meteo's daily arrays. */
export function summarizeWeather(
  daily: OpenMeteoDaily,
  tripDate: string,
): WeatherSummary | null {
  const i = daily.time?.indexOf(tripDate) ?? -1;
  if (i < 0) return null;
  const at = <T>(arr: (T | null)[] | undefined) => arr?.[i] ?? null;
  const time = (iso: string | null) => (iso ? iso.slice(11, 16) : null);
  const round = (n: number | null) => (n == null ? null : Math.round(n));

  return {
    date: tripDate,
    conditions: describeWeatherCode(at(daily.weather_code)),
    high_f: round(at(daily.temperature_2m_max)),
    low_f: round(at(daily.temperature_2m_min)),
    precip_max_pct: at(daily.precipitation_probability_max),
    sunrise: time(daily.sunrise?.[i] ?? null),
    sunset: time(daily.sunset?.[i] ?? null),
  };
}
