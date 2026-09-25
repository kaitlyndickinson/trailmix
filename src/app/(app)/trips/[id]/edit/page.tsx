import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { dangerButtonClass } from "@/components/ui";
import { TripForm } from "../../trip-form";
import { deleteTrip } from "../../actions";
import { ConfirmSubmit } from "@/components/confirm-submit";

export default async function EditTripPage({
  params,
}: PageProps<"/trips/[id]/edit">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, name, trip_date, trail_name, trail_url, trailhead_lat, trailhead_lng",
    )
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit trip</h1>
      <TripForm trip={trip} />

      <form action={deleteTrip} className="mt-6 border-t border-black/10 pt-6">
        <input type="hidden" name="id" value={trip.id} />
        <ConfirmSubmit
          message="Delete this trip and its checklist?"
          className={`${dangerButtonClass} w-full`}
        >
          Delete trip
        </ConfirmSubmit>
      </form>
    </div>
  );
}
