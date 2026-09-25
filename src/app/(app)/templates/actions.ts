"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrimaryCrew } from "@/lib/crew";
import { requireUser } from "@/lib/supabase/server";

export async function createTemplate(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const crew = await getPrimaryCrew(supabase, userId);
  if (!crew) throw new Error("You need to be in a crew first.");

  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({ crew_id: crew.id, name: name.slice(0, 80) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  redirect(`/templates/${data.id}`);
}

export async function renameTemplate(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase
    .from("checklist_templates")
    .update({ name: name.slice(0, 80) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
}

export async function deleteTemplate(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("checklist_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  redirect("/templates");
}
