import { requireUser } from "@/lib/supabase/server";
import { getPrimaryCrew } from "@/lib/crew";
import { TripForm } from "../trip-form";

export default async function NewTripPage() {
  const { supabase, userId } = await requireUser();
  const crew = await getPrimaryCrew(supabase, userId);
  const { data: templates } = crew
    ? await supabase
        .from("checklist_templates")
        .select("id, name")
        .eq("crew_id", crew.id)
        .order("created_at")
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New trip</h1>
      <TripForm templates={templates ?? []} />
    </div>
  );
}
