// App-side view of the weather summary the discover function stores in
// weather_snapshots.summary (built in supabase/functions/_shared/discovery/
// hiking-weather.ts). Presentation only: no forecasting logic lives here.

export type HourPoint = {
  time: string; // "13:00"
  hour: number;
  icon: string;
  conditions: string | null;
  temp_f: number | null;
  feels_f: number | null;
  pop: number | null;
  precip_in: number | null;
  snow_in: number | null;
  wind_mph: number | null;
  gust_mph: number | null;
  uv: number | null;
  cape: number | null;
  freezing_level_ft: number | null;
  visibility_ft: number | null;
  risk: "thunder" | "precip" | null;
};

export type WeatherFlag = {
  level: "danger" | "warn" | "info";
  kind: string;
  text: string;
};

export type WeatherAlert = {
  id: string;
  event: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  headline: string | null;
  starts: string | null;
  ends: string | null;
  instruction: string | null;
};

export type WeatherSummary = {
  date: string;
  timezone: string | null;
  elevation_ft: number | null;
  conditions: string | null;
  icon?: string;
  high_f: number | null;
  low_f: number | null;
  feels_high_f?: number | null;
  feels_low_f?: number | null;
  precip_max_pct: number | null;
  precip_in?: number | null;
  snow_in?: number | null;
  gust_max_mph?: number | null;
  uv_max?: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylight_hours?: number | null;
  freezing_level_min_ft?: number | null;
  storm_window?: {
    start: string;
    end: string;
    kind: "thunder" | "precip";
    precip_type: "rain" | "snow" | "mixed";
    peak_pop: number | null;
  } | null;
  start_early?: boolean;
  flags?: WeatherFlag[];
  hours?: HourPoint[];
  alerts?: WeatherAlert[];
  alerts_unavailable?: boolean;
};

/** Accepts a stored summary only if it's for `tripDate` and has the basics. */
export function asWeatherSummary(
  raw: unknown,
  tripDate: string | null,
): WeatherSummary | null {
  const s = raw as WeatherSummary | null | undefined;
  if (!s || !tripDate || s.date !== tripDate || s.high_f === undefined)
    return null;
  return s;
}

/** "13:00" → "1 PM", "06:52" → "6:52 AM". */
export function formatClock(hhmm: string | null | undefined): string {
  if (!hhmm) return "–";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m
    ? `${h12}:${String(m).padStart(2, "0")} ${suffix}`
    : `${h12} ${suffix}`;
}

/** Short "1–5 PM" / "11 AM–2 PM" span. */
export function formatSpan(start: string, end: string): string {
  const a = formatClock(start);
  const b = formatClock(end);
  const [aNum, aSuffix] = a.split(" ");
  const [, bSuffix] = b.split(" ");
  return aSuffix === bSuffix ? `${aNum}–${b}` : `${a}–${b}`;
}

export type WeatherBadge = { text: string; level: "danger" | "warn" };

/** One-line heads-up for lists and headers, or null if the day looks fine. */
export function weatherBadge(s: WeatherSummary | null): WeatherBadge | null {
  if (!s) return null;
  const alert = s.alerts?.[0];
  if (alert) {
    return {
      text: `⚠️ ${alert.event}`,
      level:
        alert.severity === "Extreme" || alert.severity === "Severe"
          ? "danger"
          : "warn",
    };
  }
  const w = s.storm_window;
  if (w?.kind === "thunder") {
    return { text: `⛈️ Storms ${formatSpan(w.start, w.end)}`, level: "danger" };
  }
  const danger = s.flags?.find((f) => f.level === "danger");
  if (danger) {
    const label: Record<string, string> = {
      wind: "💨 Dangerous wind",
      cold: "🥶 Frostbite risk",
    };
    return { text: label[danger.kind] ?? "⚠️ Hazard", level: "danger" };
  }
  if (w) {
    const icon = w.precip_type === "rain" ? "🌧️" : "🌨️";
    const what =
      w.precip_type === "snow"
        ? "Snow"
        : w.precip_type === "mixed"
          ? "Rain/snow"
          : "Rain";
    return {
      text: `${icon} ${what} ${formatSpan(w.start, w.end)}`,
      level: "warn",
    };
  }
  return null;
}
