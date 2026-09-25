"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getPrimaryCrew } from "@/lib/crew";
import { normalizeUrl } from "@/lib/trip-fields";

export type TripFormState = { error?: string };

/** "done" sticks until reopened; otherwise a date makes a trip planned. */
function deriveStatus(tripDate: string | null, done: boolean) {
  if (done) return "done" as const;
  return tripDate ? ("planned" as const) : ("someday" as const);
}

function readTripFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const tripDate = String(formData.get("trip_date") ?? "").trim() || null;
  const trailName = String(formData.get("trail_name") ?? "").trim() || null;
  const trailUrl = normalizeUrl(String(formData.get("trail_url") ?? ""));
  const latRaw = String(formData.get("trailhead_lat") ?? "");
  const lngRaw = String(formData.get("trailhead_lng") ?? "");
  const hasPin = latRaw !== "" && lngRaw !== "";

  return {
    name,
    trip_date: tripDate,
    trail_name: trailName,
    trail_url: trailUrl,
    trailhead_lat: hasPin ? Number(latRaw) : null,
    trailhead_lng: hasPin ? Number(lngRaw) : null,
  };
}

export async function createTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const { supabase, userId } = await requireUser();
  const fields = readTripFields(formData);
  if (!fields.name) return { error: "Give the trip a name." };

  const crew = await getPrimaryCrew(supabase, userId);
  if (!crew) return { error: "You need to be in a crew first." };

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      ...fields,
      crew_id: crew.id,
      status: deriveStatus(fields.trip_date, false),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // The trip exists at this point, so always land on it. If the template
  // didn't apply, the checklist is just empty and items can be added there;
  // returning to the form would make a retry create a duplicate trip.
  const templateId = String(formData.get("template_id") ?? "");
  if (templateId) {
    const { error: templateError } = await supabase.rpc(
      "apply_checklist_template",
      { p_trip_id: trip.id, p_template_id: templateId },
    );
    if (templateError) console.error("apply_checklist_template", templateError);
  }

  revalidatePath("/");
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const fields = readTripFields(formData);
  if (!fields.name) return { error: "Give the trip a name." };

  const { data: current, error: readError } = await supabase
    .from("trips")
    .select("status")
    .eq("id", id)
    .single();
  if (readError) return { error: readError.message };

  const status = deriveStatus(fields.trip_date, current.status === "done");

  const { error } = await supabase
    .from("trips")
    .update({ ...fields, status })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath(`/trips/${id}`);
  redirect(`/trips/${id}`);
}

export async function deleteTrip(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

export async function setTripDone(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";

  // Read the date from the DB, not the (possibly stale) page.
  const { data: trip, error: readError } = await supabase
    .from("trips")
    .select("trip_date")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);
  const status = deriveStatus(trip.trip_date, done);

  const { error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/trips/${id}`);
}
