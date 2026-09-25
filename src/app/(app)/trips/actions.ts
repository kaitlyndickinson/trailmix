"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getPrimaryCrew } from "@/lib/crew";
import { normalizeUrl } from "@/lib/trip-fields";

export type TripFormState = { error?: string };

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
      status: fields.trip_date ? "planned" : "someday",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const templateId = String(formData.get("template_id") ?? "");
  if (templateId) {
    const { error: templateError } = await supabase.rpc(
      "apply_checklist_template",
      { p_trip_id: trip.id, p_template_id: templateId },
    );
    if (templateError) return { error: templateError.message };
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

  const status =
    current.status === "done"
      ? "done"
      : fields.trip_date
        ? "planned"
        : "someday";

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
  const tripDate = String(formData.get("trip_date") ?? "");
  const status = done ? "done" : tripDate ? "planned" : "someday";

  const { error } = await supabase
    .from("trips")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/trips/${id}`);
}
