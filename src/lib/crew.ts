import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

/**
 * The crew new trips go into. Normally a user is in exactly one crew
 * (redeeming an invite removes their untouched default crew). If they're in
 * several, prefer the one with the most members, then the earliest joined.
 */
export async function getPrimaryCrew(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: memberships, error } = await supabase
    .from("crew_members")
    .select("crew_id, role, created_at, crews(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!memberships?.length) return null;

  const crewIds = memberships.map((m) => m.crew_id);
  const { data: allMembers, error: countError } = await supabase
    .from("crew_members")
    .select("crew_id")
    .in("crew_id", crewIds);
  if (countError) throw countError;

  const counts = new Map<string, number>();
  for (const m of allMembers ?? []) {
    counts.set(m.crew_id, (counts.get(m.crew_id) ?? 0) + 1);
  }

  // Stable sort keeps earliest-joined first among ties.
  const best = [...memberships].sort(
    (a, b) => (counts.get(b.crew_id) ?? 0) - (counts.get(a.crew_id) ?? 0),
  )[0];

  return {
    id: best.crew_id,
    name: best.crews?.name ?? "Crew",
    role: best.role,
    memberCount: counts.get(best.crew_id) ?? 1,
  };
}
