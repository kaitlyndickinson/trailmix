export const FORECAST_WINDOW_DAYS = 16;

/** Whole days from `today` to `tripDate` (both YYYY-MM-DD). */
export function daysUntil(tripDate: string, today: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(tripDate) - toUtc(today)) / 86_400_000);
}

/**
 * Whether a trip date can be forecast. `today` is a UTC date, so one day of
 * slack keeps "today at the trailhead" in range when UTC has already rolled
 * over (e.g. a Colorado evening).
 */
export function isInForecastWindow(tripDate: string, today: string): boolean {
  const days = daysUntil(tripDate, today);
  return days >= -1 && days < FORECAST_WINDOW_DAYS;
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
