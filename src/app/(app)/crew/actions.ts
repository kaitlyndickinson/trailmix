"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export async function createInvite(formData: FormData) {
  const { supabase } = await requireUser();
  const crewId = String(formData.get("crew_id") ?? "");
  const { error } = await supabase
    .from("crew_invites")
    .insert({ crew_id: crewId });
  if (error) throw new Error(error.message);
  revalidatePath("/crew");
}

export async function revokeInvite(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("crew_invites").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/crew");
}

export async function renameCrew(formData: FormData) {
  const { supabase } = await requireUser();
  const crewId = String(formData.get("crew_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase
    .from("crews")
    .update({ name: name.slice(0, 80) })
    .eq("id", crewId);
  if (error) throw new Error(error.message);
  revalidatePath("/crew");
}

export type JoinState = { error?: string };

export async function joinCrew(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const { supabase } = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter an invite code." };

  const { error } = await supabase.rpc("redeem_crew_invite", { p_code: code });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/crew?joined=1");
}
