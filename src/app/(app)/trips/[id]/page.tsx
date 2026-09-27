import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { TrailheadMap } from "@/components/map";
import { secondaryButtonClass } from "@/components/ui";
import { directionsUrl, formatTripDate } from "@/lib/trip-fields";
import { setTripDone } from "../actions";
import { Checklist } from "./checklist";
import { Nearby } from "./nearby";
import { loadNearby } from "./nearby-data";
import { WeatherBadge } from "@/components/weather-badge";
import { loadWeatherBadges } from "@/lib/weather-badges";

export default async function TripPage({
  params,
  searchParams,
}: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "nearby" ? "nearby" : "checklist";
  const { supabase } = await requireUser();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  const [
    { data: items },
    { data: members },
    { data: templates },
    nearby,
    badges,
  ] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("id, label, category, sort, checked, checked_by")
      .eq("trip_id", trip.id)
      .order("sort"),
    supabase
      .from("crew_members")
      .select("user_id, profiles(display_name)")
      .eq("crew_id", trip.crew_id),
    supabase
      .from("checklist_templates")
      .select("id, name")
      .eq("crew_id", trip.crew_id)
      .order("created_at"),
    activeTab === "nearby"
      ? loadNearby(supabase, trip.id, trip.trip_date)
      : null,
    trip.status !== "done" ? loadWeatherBadges(supabase, [trip]) : null,
  ]);

  const names = Object.fromEntries(
    (members ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? "?"]),
  );
  const pin =
    trip.trailhead_lat != null && trip.trailhead_lng != null
      ? { lat: trip.trailhead_lat, lng: trip.trailhead_lng }
      : null;
  const isDone = trip.status === "done";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/"
          className="text-forest -ml-1 inline-flex min-h-11 items-center px-1 text-sm"
        >
          ← Trips
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-semibold">
              {trip.name}
            </h1>
            <p className="text-foreground/60 mt-1">
              {trip.trip_date
                ? formatTripDate(trip.trip_date, { withYear: true })
                : "Someday"}
              {trip.trail_name && <> · {trip.trail_name}</>}
            </p>
            {badges?.get(trip.id) && (
              <div className="mt-2">
                <WeatherBadge badge={badges.get(trip.id)!} />
              </div>
            )}
          </div>
          <Link
            href={`/trips/${trip.id}/edit`}
            className={`${secondaryButtonClass} shrink-0`}
          >
            Edit
          </Link>
        </div>
      </div>

      {pin && <TrailheadMap value={pin} className="h-40" />}

      <div className="flex flex-wrap gap-2">
        {pin && (
          <a
            href={directionsUrl(pin.lat, pin.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryButtonClass}
          >
            Directions
          </a>
        )}
        {trip.trail_url && (
          <a
            href={trip.trail_url}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryButtonClass}
          >
            Open trail
          </a>
        )}
        <form action={setTripDone}>
          <input type="hidden" name="id" value={trip.id} />
          <input type="hidden" name="done" value={String(!isDone)} />
          <button type="submit" className={secondaryButtonClass}>
            {isDone ? "Reopen" : "Mark done"}
          </button>
        </form>
      </div>

      <nav
        className="bg-sand grid grid-cols-2 rounded-xl p-1"
        aria-label="Trip sections"
      >
        <TabLink href={`/trips/${trip.id}`} active={activeTab === "checklist"}>
          Checklist
        </TabLink>
        <TabLink
          href={`/trips/${trip.id}?tab=nearby`}
          active={activeTab === "nearby"}
        >
          Nearby
        </TabLink>
      </nav>

      {activeTab === "checklist" ? (
        <Checklist
          tripId={trip.id}
          initialItems={items ?? []}
          names={names}
          templates={templates ?? []}
        />
      ) : (
        <Nearby
          tripId={trip.id}
          hasPin={pin != null}
          tripDate={trip.trip_date}
          radiusM={trip.discovery_radius_m}
          initialRecommendations={nearby?.recommendations ?? []}
          weather={nearby?.weather ?? null}
          weatherFetchedAt={nearby?.weatherFetchedAt ?? null}
          lastRun={nearby?.lastRun ?? null}
        />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-medium ${
        active ? "text-forest bg-white shadow-sm" : "text-foreground/60"
      }`}
    >
      {children}
    </Link>
  );
}
