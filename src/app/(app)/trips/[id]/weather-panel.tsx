"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { localToday } from "@/lib/trip-fields";
import { timeAgo, useNow } from "@/lib/use-now";
import {
  activeAlerts,
  formatClock,
  formatSpan,
  type HourPoint,
  type WeatherFlag,
  type WeatherSummary,
} from "@/lib/weather";

/** Forecasts older than this refresh automatically for trips today/tomorrow. */
const AUTO_REFRESH_AFTER_MS = 3 * 60 * 60 * 1000;

const noopSubscribe = () => () => {};

function daysBetween(today: string, isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
}

export function WeatherPanel({
  tripId,
  tripDate,
  weather,
  fetchedAt,
}: {
  tripId: string;
  tripDate: string | null;
  weather: WeatherSummary | null;
  fetchedAt: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const now = useNow();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  // The device's local date; null during SSR and hydration so the server
  // (UTC) and the phone never disagree about which day it is.
  const today = useSyncExternalStore(noopSubscribe, localToday, () => null);
  const days = tripDate && today ? daysBetween(today, tripDate) : null;
  const inWindow = days != null && days >= 0 && days < 16;

  async function update() {
    setUpdating(true);
    setError(null);
    const { error } = await supabase.functions.invoke("discover", {
      body: { trip_id: tripId, mode: "weather" },
    });
    if (error) {
      let message = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          message = (await error.context.json()).error ?? message;
        } catch {
          // keep the generic message
        }
      }
      setError(message);
    }
    setUpdating(false);
    router.refresh();
  }

  // On-demand freshness: opening a trip that's today or tomorrow with a stale
  // (or missing) forecast quietly fetches a new one, once per visit.
  const refreshIfStale = useEffectEvent(() => {
    if (autoTried.current || days == null || days < 0 || days > 1) return;
    const stale =
      !fetchedAt || Date.now() - Date.parse(fetchedAt) > AUTO_REFRESH_AFTER_MS;
    if (!stale) return;
    autoTried.current = true;
    void update();
  });
  useEffect(() => {
    if (today == null) return; // wait until the local date is known
    // Deferred so it runs after mount (and survives React's dev double-run).
    const id = setTimeout(refreshIfStale, 0);
    return () => clearTimeout(id);
  }, [today]);

  if (!tripDate) {
    return <Note>Add a date to see the forecast.</Note>;
  }
  if (today == null && !weather) {
    return <Note>Loading the forecast…</Note>;
  }
  if (today != null && !inWindow) {
    return <Note>The forecast shows up once the trip is within 16 days.</Note>;
  }
  const alerts = activeAlerts(weather?.alerts, now);

  const updatedLabel = updating
    ? "Updating…"
    : fetchedAt && now
      ? `Updated ${timeAgo(fetchedAt, now)}`
      : null;

  return (
    <section className="flex flex-col gap-3" aria-label="Forecast">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-forest text-xs font-semibold tracking-widest uppercase">
          Forecast
        </h3>
        <div className="flex items-center gap-1">
          {updatedLabel && (
            <span className="text-foreground/50 text-xs">{updatedLabel}</span>
          )}
          <button
            type="button"
            onClick={() => void update()}
            disabled={updating}
            className="text-forest min-h-11 px-2 text-sm font-medium disabled:opacity-50"
          >
            Update
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {!weather ? (
        <Note>
          {updating ? "Getting the forecast…" : "No forecast yet. Tap Update."}
        </Note>
      ) : (
        <>
          <Overview weather={weather} />
          {alerts.length > 0 && <Alerts alerts={alerts} />}
          {weather.alerts_unavailable && (
            <p className="text-foreground/50 text-xs">
              Couldn&apos;t check National Weather Service alerts this time.
            </p>
          )}
          {weather.flags && weather.flags.length > 0 && (
            <Flags flags={weather.flags} />
          )}
          {weather.hours && weather.hours.length > 0 && (
            <HourlyStrip hours={weather.hours} />
          )}
          <p className="text-foreground/50 text-xs">
            {weather.elevation_ft != null &&
              `Forecast for ${weather.elevation_ft.toLocaleString("en-US")} ft (the trailhead pin). `}
            {weather.timezone &&
              `Times in ${weather.timezone.replace("_", " ")}. `}
            Weather: Open-Meteo · Alerts: NWS
          </p>
        </>
      )}
    </section>
  );
}

function stormLabel(w: NonNullable<WeatherSummary["storm_window"]>): string {
  if (w.kind === "thunder") return "⛈️ Storms";
  if (w.precip_type === "snow") return "🌨️ Snow";
  if (w.precip_type === "mixed") return "🌨️ Rain/snow";
  return "🌧️ Rain";
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sand/60 text-foreground/70 rounded-2xl p-4 text-sm">
      {children}
    </div>
  );
}

function Overview({ weather: w }: { weather: WeatherSummary }) {
  const stats: [string, string][] = [
    [
      "Rain/snow chance",
      w.precip_max_pct != null ? `${w.precip_max_pct}%` : "–",
    ],
    ["Precip", w.precip_in != null ? `${w.precip_in} in` : "–"],
    ["New snow", w.snow_in ? `${w.snow_in} in` : "None"],
    ["Max gusts", w.gust_max_mph != null ? `${w.gust_max_mph} mph` : "–"],
    ["UV max", w.uv_max != null ? String(Math.round(w.uv_max)) : "–"],
    [
      "Freezing level",
      w.freezing_level_min_ft != null
        ? `${(Math.round(w.freezing_level_min_ft / 100) * 100).toLocaleString("en-US")} ft`
        : "–",
    ],
    ["Sunrise", formatClock(w.sunrise)],
    ["Sunset", formatClock(w.sunset)],
    ["Daylight", w.daylight_hours != null ? `${w.daylight_hours} h` : "–"],
  ];

  return (
    <div className="bg-forest rounded-2xl p-4 text-white">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl" aria-hidden>
            {w.icon ?? ""}
          </p>
          <p className="text-lg leading-tight font-semibold">
            {w.conditions ?? "—"}
          </p>
          {w.storm_window && (
            <p className="mt-1 text-sm text-white/80">
              {stormLabel(w.storm_window)}{" "}
              {formatSpan(w.storm_window.start, w.storm_window.end)}
              {w.start_early && " · start early"}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold">
            {w.high_f ?? "–"}°
            <span className="text-lg text-white/60"> / {w.low_f ?? "–"}°</span>
          </p>
          {w.feels_low_f != null && w.feels_high_f != null && (
            <p className="text-xs text-white/70">
              Feels {w.feels_low_f}° to {w.feels_high_f}°
            </p>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-2 text-sm">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-white/60">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const ALERT_STYLE: Record<string, string> = {
  Extreme: "border-red-300 bg-red-50 text-red-900",
  Severe: "border-red-300 bg-red-50 text-red-900",
  Moderate: "border-sun bg-sun/20",
  Minor: "border-sun bg-sun/10",
  Unknown: "border-black/10 bg-white",
};

function Alerts({ alerts }: { alerts: NonNullable<WeatherSummary["alerts"]> }) {
  return (
    <ul
      className="flex flex-col gap-2"
      aria-label="National Weather Service alerts"
    >
      {alerts.map((a) => (
        <li
          key={a.id}
          className={`rounded-xl border p-3 text-sm ${ALERT_STYLE[a.severity]}`}
        >
          <details>
            <summary className="flex min-h-6 cursor-pointer list-none items-start justify-between gap-2">
              <span>
                <span className="font-semibold">⚠️ {a.event}</span>
                {a.ends && (
                  <span className="opacity-70">
                    {" "}
                    until{" "}
                    {new Date(a.ends).toLocaleString("en-US", {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs opacity-60">Details</span>
            </summary>
            {a.headline && <p className="mt-2">{a.headline}</p>}
            {a.instruction && (
              <p className="mt-2 opacity-80">{a.instruction}</p>
            )}
          </details>
        </li>
      ))}
    </ul>
  );
}

const FLAG_STYLE: Record<WeatherFlag["level"], { box: string; icon: string }> =
  {
    danger: { box: "bg-red-50 text-red-900", icon: "⚠️" },
    warn: { box: "bg-sun/20", icon: "⚠" },
    info: { box: "bg-sand/60 text-foreground/80", icon: "ℹ︎" },
  };

function Flags({ flags }: { flags: WeatherFlag[] }) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Hiking conditions">
      {flags.map((f) => (
        <li
          key={`${f.kind}:${f.text}`}
          className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${FLAG_STYLE[f.level].box}`}
        >
          <span aria-hidden className="shrink-0">
            {FLAG_STYLE[f.level].icon}
          </span>
          <span>{f.text}</span>
        </li>
      ))}
    </ul>
  );
}

function HourlyStrip({ hours }: { hours: HourPoint[] }) {
  return (
    <div>
      <p className="text-foreground/60 mb-1 text-xs">
        Hourly · chance of precip · gusts (mph)
      </p>
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <ol className="flex gap-1.5">
          {hours.map((h) => (
            <li
              key={h.time}
              className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl border py-2 text-center ${
                h.risk === "thunder"
                  ? "border-red-200 bg-red-50"
                  : h.risk === "precip"
                    ? "border-sky-200 bg-sky-50"
                    : "border-black/5 bg-white"
              }`}
              title={h.conditions ?? undefined}
            >
              <span className="text-foreground/60 text-[11px]">
                {formatClock(h.time).replace(":00", "")}
              </span>
              <span aria-hidden className="text-lg leading-none">
                {h.icon}
              </span>
              <span className="text-sm font-semibold">
                {h.temp_f != null ? `${h.temp_f}°` : "–"}
              </span>
              <span className="text-foreground/50 text-[11px]">
                {h.feels_f != null ? `feels ${h.feels_f}°` : ""}
              </span>
              <span
                className={`text-[11px] font-medium ${
                  (h.pop ?? 0) >= 40 ? "text-sky-700" : "text-foreground/50"
                }`}
              >
                💧{h.pop ?? 0}%
              </span>
              <span className="text-foreground/60 text-[11px]">
                {h.gust_mph != null ? `💨${h.gust_mph}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
