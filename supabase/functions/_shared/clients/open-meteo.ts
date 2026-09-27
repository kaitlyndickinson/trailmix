import type { LatLng } from "../discovery/types.ts";
import type { OpenMeteoForecast } from "../discovery/hiking-weather.ts";
import { fetchJson } from "./http.ts";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export type OpenMeteoResponse = OpenMeteoForecast;

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
      "apparent_temperature_max",
      "apparent_temperature_min",
      "precipitation_sum",
      "snowfall_sum",
      "precipitation_probability_max",
      "weather_code",
      "wind_gusts_10m_max",
      "uv_index_max",
      "sunrise",
      "sunset",
      "daylight_duration",
    ].join(","),
    // Hiker-relevant hourly detail; see _shared/discovery/hiking-weather.ts.
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "snowfall",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "cloud_cover",
      "uv_index",
      "cape",
      "freezing_level_height",
      "visibility",
      "is_day",
    ].join(","),
  });
  return (await fetchJson("open-meteo", `${ENDPOINT}?${params}`)) as OpenMeteoResponse;
}
