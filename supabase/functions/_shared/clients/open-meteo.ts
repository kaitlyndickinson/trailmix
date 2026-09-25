import type { LatLng } from "../discovery/types.ts";
import { fetchJson } from "./http.ts";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export type OpenMeteoResponse = {
  timezone?: string;
  utc_offset_seconds?: number;
  daily?: Record<string, unknown[]>;
  hourly?: Record<string, unknown[]>;
};

/** Daily + hourly forecast for one date, in the trailhead's local timezone. */
export async function fetchForecast(
  at: LatLng,
  isoDate: string,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: String(at.lat),
    longitude: String(at.lng),
    timezone: "auto",
    start_date: isoDate,
    end_date: isoDate,
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "weather_code",
      "sunrise",
      "sunset",
    ].join(","),
    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
  });
  return (await fetchJson("open-meteo", `${ENDPOINT}?${params}`)) as OpenMeteoResponse;
}
