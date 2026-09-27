import type { WeatherBadge as Badge } from "@/lib/weather";

/** Small forecast heads-up chip, e.g. "⛈️ Storms 1–5 PM". */
export function WeatherBadge({ badge }: { badge: Badge }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        badge.level === "danger"
          ? "bg-red-50 text-red-800"
          : "bg-sun/25 text-foreground/80"
      }`}
    >
      {badge.text}
    </span>
  );
}
