"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, useNow } from "@/lib/use-now";
import { directionsUrl } from "@/lib/trip-fields";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { WeatherSummary } from "@/lib/weather";
import { WeatherPanel } from "./weather-panel";

export type Recommendation = {
  item_type: string;
  item_id: string;
  name: string;
  category: string;
  score: number;
  reasons: string[];
  pinned: boolean;
  dismissed: boolean;
  url: string | null;
  lat: number | null;
  lng: number | null;
};

export type LastRun = {
  status: string;
  finished_at: string | null;
  failed_sources: string[];
};

const CATEGORIES: { key: string; label: string; tag: string; icon: string }[] =
  [
    { key: "event", tag: "Event", label: "Events that day", icon: "🎟️" },
    { key: "brewery", tag: "Brewery", label: "Breweries", icon: "🍺" },
    { key: "viewpoint", tag: "Viewpoint", label: "Viewpoints", icon: "🏔️" },
    { key: "restaurant", tag: "Food", label: "Food", icon: "🍽️" },
    { key: "cafe", tag: "Coffee", label: "Coffee", icon: "☕" },
    { key: "ice_cream", tag: "Ice cream", label: "Ice cream", icon: "🍦" },
    { key: "bar", tag: "Bar", label: "Bars", icon: "🍸" },
    { key: "museum", tag: "Museum", label: "Museums", icon: "🏛️" },
    { key: "historic", tag: "Historic", label: "Historic", icon: "📜" },
    { key: "other", tag: "Spot", label: "Other spots", icon: "📍" },
  ];

const METERS_PER_MILE = 1609.344;
const RADIUS_MILES = [5, 10, 15, 25];

/** The chip closest to a stored radius (the default 16 km reads as 10 mi). */
function nearestMiles(radiusM: number): number {
  const miles = radiusM / METERS_PER_MILE;
  return RADIUS_MILES.reduce((best, m) =>
    Math.abs(m - miles) < Math.abs(best - miles) ? m : best,
  );
}

const SOURCE_LABELS: Record<string, string> = {
  overpass: "places",
  ticketmaster: "events",
  open_meteo: "weather",
};

export function Nearby({
  tripId,
  hasPin,
  tripDate,
  radiusM,
  initialRecommendations,
  weather,
  weatherFetchedAt,
  lastRun,
}: {
  tripId: string;
  hasPin: boolean;
  tripDate: string | null;
  radiusM: number;
  initialRecommendations: Recommendation[];
  weather: WeatherSummary | null;
  weatherFetchedAt: string | null;
  lastRun: LastRun | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const now = useNow();
  const [recs, setRecs] = useState(initialRecommendations);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [miles, setMiles] = useState(() => nearestMiles(radiusM));

  // Keep local state in step when the server sends fresh results.
  const [seen, setSeen] = useState(initialRecommendations);
  if (seen !== initialRecommendations) {
    setSeen(initialRecommendations);
    setRecs(initialRecommendations);
  }

  async function refresh() {
    setRefreshing(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("discover", {
      body: { trip_id: tripId },
    });
    if (error) {
      let message = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          message = (await error.context.json()).error ?? message;
        } catch {
          // Non-JSON error body; keep the generic message.
        }
      }
      setError(message);
    } else if (data?.status === "error") {
      setError(data.error ?? "Refresh failed.");
    }
    setRefreshing(false);
    router.refresh();
  }

  async function changeRadius(next: number) {
    if (next === miles || refreshing) return;
    const before = miles;
    setMiles(next);
    setError(null);
    const { error } = await supabase
      .from("trips")
      .update({ discovery_radius_m: Math.round(next * METERS_PER_MILE) })
      .eq("id", tripId);
    if (error) {
      setMiles(before);
      setError(error.message);
      return;
    }
    await refresh();
  }

  async function setFlag(
    rec: Recommendation,
    flag: "pinned" | "dismissed",
    value: boolean,
  ) {
    const before = recs;
    setRecs((cur) =>
      cur.map((r) =>
        r.item_type === rec.item_type && r.item_id === rec.item_id
          ? { ...r, [flag]: value }
          : r,
      ),
    );
    const { error } = await supabase
      .from("trip_recommendations")
      .update(flag === "pinned" ? { pinned: value } : { dismissed: value })
      .eq("trip_id", tripId)
      .eq("item_type", rec.item_type)
      .eq("item_id", rec.item_id);
    if (error) {
      setRecs(before);
      setError(error.message);
    }
  }

  if (!hasPin) {
    return (
      <div className="border-forest/30 rounded-2xl border border-dashed p-6 text-center">
        <p className="text-foreground/70">
          Drop a trailhead pin to see what&apos;s nearby.
        </p>
        <Link
          href={`/trips/${tripId}/edit`}
          className={`${primaryButtonClass} mt-3`}
        >
          Add trailhead
        </Link>
      </div>
    );
  }

  const visible = recs.filter((r) => showDismissed || !r.dismissed);
  const dismissedCount = recs.filter((r) => r.dismissed).length;
  const byScore = (a: Recommendation, b: Recommendation) => b.score - a.score;
  // Pinned items get their own section at the top, tagged with their category.
  const groups = [
    {
      key: "pinned",
      label: "Pinned",
      icon: "📌",
      showCategory: true,
      items: visible.filter((r) => r.pinned).sort(byScore),
    },
    ...CATEGORIES.map((c) => ({
      ...c,
      showCategory: false,
      items: visible
        .filter((r) => !r.pinned && r.category === c.key)
        .sort(byScore),
    })),
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground/60 text-sm">
          {refreshing
            ? "Looking around… this can take up to a minute"
            : lastRun?.finished_at && now
              ? `Updated ${timeAgo(lastRun.finished_at, now)}`
              : lastRun
                ? "Updated"
                : "Not checked yet"}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className={secondaryButtonClass}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="Search within"
        className="flex items-center gap-2"
      >
        <span className="text-foreground/60 shrink-0 text-sm">Within</span>
        <div className="bg-sand grid flex-1 grid-cols-4 rounded-xl p-1">
          {RADIUS_MILES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={miles === m}
              disabled={refreshing}
              onClick={() => void changeRadius(m)}
              className={`min-h-11 rounded-lg text-sm font-medium disabled:opacity-60 ${
                miles === m
                  ? "text-forest bg-white shadow-sm"
                  : "text-foreground/60"
              }`}
            >
              {m} mi
            </button>
          ))}
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
      {lastRun && lastRun.failed_sources.length > 0 && !refreshing && (
        <div
          role="status"
          className="border-sun bg-sun/20 flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
        >
          <p>
            Couldn&apos;t load{" "}
            {lastRun.failed_sources
              .map((s) => SOURCE_LABELS[s] ?? s)
              .join(" or ")}{" "}
            last time, so this list may be incomplete.
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-forest min-h-11 shrink-0 px-2 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      <WeatherPanel
        tripId={tripId}
        tripDate={tripDate}
        weather={weather}
        fetchedAt={weatherFetchedAt}
      />

      {groups.length === 0 && !refreshing && (
        <div className="border-forest/30 text-foreground/60 rounded-2xl border border-dashed p-6 text-center">
          {lastRun
            ? "Nothing found nearby. Try a bigger radius later."
            : "Tap Refresh to find breweries, food, and viewpoints near the trailhead."}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="text-forest mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
            <span aria-hidden className="text-base">
              {group.icon}
            </span>
            {group.label}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.items.map((rec) => (
              <RecommendationCard
                key={`${rec.item_type}:${rec.item_id}`}
                rec={rec}
                categoryTag={
                  group.showCategory ? categoryTag(rec.category) : undefined
                }
                onPin={(v) => void setFlag(rec, "pinned", v)}
                onDismiss={(v) => void setFlag(rec, "dismissed", v)}
              />
            ))}
          </ul>
        </section>
      ))}

      {dismissedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDismissed((v) => !v)}
          className="text-foreground/60 min-h-11 text-sm underline"
        >
          {showDismissed
            ? "Hide dismissed"
            : `Show ${dismissedCount} dismissed`}
        </button>
      )}
    </div>
  );
}

function categoryTag(category: string): string {
  const c = CATEGORIES.find((c) => c.key === category);
  return c ? `${c.icon} ${c.tag}` : "📍 Spot";
}

function RecommendationCard({
  rec,
  categoryTag,
  onPin,
  onDismiss,
}: {
  rec: Recommendation;
  categoryTag?: string;
  onPin: (value: boolean) => void;
  onDismiss: (value: boolean) => void;
}) {
  return (
    <li
      className={`rounded-2xl border bg-white p-3 ${
        rec.pinned ? "border-forest/40" : "border-black/10"
      } ${rec.dismissed ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{rec.name}</p>
        {categoryTag && (
          <span className="text-foreground/60 shrink-0 text-xs">
            {categoryTag}
          </span>
        )}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {rec.reasons.map((reason) => (
          <li
            key={reason}
            className={`rounded-full px-2 py-0.5 text-xs ${
              reason.startsWith("Closed")
                ? "bg-red-50 text-red-800"
                : reason.startsWith("Open") || reason.startsWith("Event")
                  ? "bg-forest/10 text-forest"
                  : "bg-sand text-foreground/70"
            }`}
          >
            {reason}
          </li>
        ))}
      </ul>
      <div className="mt-2 -mb-1 flex flex-wrap gap-x-1">
        <ActionButton onClick={() => onPin(!rec.pinned)}>
          {rec.pinned ? "Unpin" : "Pin"}
        </ActionButton>
        <ActionButton onClick={() => onDismiss(!rec.dismissed)}>
          {rec.dismissed ? "Restore" : "Dismiss"}
        </ActionButton>
        {rec.lat != null && rec.lng != null && (
          <ActionLink href={directionsUrl(rec.lat, rec.lng)}>
            Directions
          </ActionLink>
        )}
        {rec.url && <ActionLink href={rec.url}>Website</ActionLink>}
      </div>
    </li>
  );
}

const actionClass =
  "inline-flex min-h-11 items-center px-2 text-sm font-medium text-forest";

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={actionClass}>
      {children}
    </button>
  );
}

function ActionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={actionClass}
    >
      {children}
    </a>
  );
}
