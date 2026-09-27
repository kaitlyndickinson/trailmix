import { describe, expect, it } from "vitest";
import {
  activeAlerts,
  asWeatherSummary,
  formatClock,
  formatSpan,
  weatherBadge,
  type WeatherSummary,
} from "./weather";

const base: WeatherSummary = {
  date: "2026-10-03",
  timezone: "America/Denver",
  elevation_ft: 11700,
  conditions: "Partly cloudy",
  high_f: 55,
  low_f: 34,
  precip_max_pct: 20,
  sunrise: "06:59",
  sunset: "18:40",
};

describe("formatting", () => {
  it("formats clock times and spans", () => {
    expect(formatClock("06:52")).toBe("6:52 AM");
    expect(formatClock("13:00")).toBe("1 PM");
    expect(formatClock(null)).toBe("–");
    expect(formatSpan("13:00", "17:00")).toBe("1–5 PM");
    expect(formatSpan("11:00", "14:00")).toBe("11 AM–2 PM");
  });
});

describe("asWeatherSummary", () => {
  it("only accepts a summary for the trip's current date", () => {
    expect(asWeatherSummary(base, "2026-10-03")).toBe(base);
    expect(asWeatherSummary(base, "2026-10-04")).toBeNull();
    expect(asWeatherSummary(base, null)).toBeNull();
    expect(asWeatherSummary({}, "2026-10-03")).toBeNull();
  });
});

describe("weatherBadge", () => {
  it("is null on a fine day", () => {
    expect(weatherBadge(base)).toBeNull();
    expect(weatherBadge(null)).toBeNull();
  });

  it("prefers official alerts, then thunderstorms, then danger flags, then precip", () => {
    const storm = {
      ...base,
      storm_window: {
        start: "13:00",
        end: "17:00",
        kind: "thunder" as const,
        precip_type: "rain" as const,
        peak_pop: 70,
      },
    };
    expect(weatherBadge(storm)).toEqual({
      text: "⛈️ Storms 1–5 PM",
      level: "danger",
    });
    expect(
      weatherBadge({
        ...storm,
        alerts: [
          {
            id: "a",
            event: "Red Flag Warning",
            severity: "Severe",
            headline: null,
            starts: null,
            ends: null,
            instruction: null,
          },
        ],
      }),
    ).toEqual({ text: "⚠️ Red Flag Warning", level: "danger" });
    expect(
      weatherBadge({
        ...base,
        flags: [{ level: "danger", kind: "wind", text: "" }],
      }),
    ).toEqual({ text: "💨 Dangerous wind", level: "danger" });
    expect(
      weatherBadge({
        ...base,
        storm_window: {
          start: "14:00",
          end: "21:00",
          kind: "precip",
          precip_type: "snow",
          peak_pop: 60,
        },
      }),
    ).toEqual({ text: "🌨️ Snow 2–9 PM", level: "warn" });
  });
});

describe("activeAlerts", () => {
  const alert = (ends: string | null) => ({
    id: ends ?? "open",
    event: "Wind Advisory",
    severity: "Moderate" as const,
    headline: null,
    starts: null,
    ends,
    instruction: null,
  });
  const now = Date.parse("2026-10-03T12:00:00-06:00");

  it("drops alerts that have ended, keeps open-ended ones", () => {
    const alerts = [
      alert("2026-10-03T08:00:00-06:00"),
      alert("2026-10-03T20:00:00-06:00"),
      alert(null),
    ];
    expect(activeAlerts(alerts, now).map((a) => a.id)).toEqual([
      "2026-10-03T20:00:00-06:00",
      "open",
    ]);
  });

  it("keeps everything while the clock is unknown (SSR)", () => {
    expect(
      activeAlerts([alert("2026-10-03T08:00:00-06:00")], null),
    ).toHaveLength(1);
    expect(activeAlerts(undefined, now)).toEqual([]);
  });

  it("an expired alert no longer drives the badge", () => {
    const s: WeatherSummary = {
      ...base,
      alerts: [alert("2026-10-03T08:00:00-06:00")],
    };
    expect(weatherBadge(s, now)).toBeNull();
  });
});
