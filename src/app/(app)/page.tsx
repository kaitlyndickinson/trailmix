import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { loadWeatherBadges } from "@/lib/weather-badges";
import { primaryButtonClass } from "@/components/ui";
import { TripList } from "./trips/trip-list";

export default async function TripsPage() {
  const { supabase } = await requireUser();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, trip_date, trail_name, status, checklist_items(checked)")
    .order("trip_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const upcoming = (trips ?? []).filter((t) => t.status !== "done");
  const badges = await loadWeatherBadges(supabase, upcoming);

  const rows = (trips ?? []).map(({ checklist_items, ...t }) => ({
    ...t,
    total: checklist_items.length,
    checked: checklist_items.filter((i) => i.checked).length,
    weather: badges.get(t.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Link href="/trips/new" className={primaryButtonClass}>
          + Trip
        </Link>
      </div>
      <TripList trips={rows} />
    </div>
  );
}
