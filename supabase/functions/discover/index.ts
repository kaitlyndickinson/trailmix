// POST { trip_id } → runs discovery for a trip the caller's crew owns.
// The caller's JWT is verified here (verify_jwt is off in config.toml), and
// membership is checked by reading the trip with the caller's own RLS.
// The service role is only used for writes to the shared cache and results.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http-response.ts";
import { supabaseEnv } from "../_shared/supabase-env.ts";
import { runDiscovery, type TripForDiscovery } from "./pipeline.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_COOLDOWN_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in required" }, 401);

  let tripId: unknown;
  try {
    ({ trip_id: tripId } = await req.json());
  } catch {
    return json({ error: "Body must be JSON: { trip_id }" }, 400);
  }
  if (typeof tripId !== "string" || !UUID.test(tripId)) {
    return json({ error: "trip_id must be a UUID" }, 400);
  }

  const env = supabaseEnv();
  const userClient = createClient(env.url, env.publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claims?.claims?.sub) {
    return json({ error: "Invalid or expired session" }, 401);
  }

  // RLS returns no row unless the caller is in the trip's crew.
  const { data: trip, error: tripError } = await userClient
    .from("trips")
    .select("id, trailhead_lat, trailhead_lng, trip_date, discovery_radius_m")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError) return json({ error: tripError.message }, 500);
  if (!trip) return json({ error: "Trip not found" }, 404);
  if (trip.trailhead_lat == null || trip.trailhead_lng == null) {
    return json({ error: "Set a trailhead pin to find places nearby." }, 400);
  }

  const admin = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count } = await admin
    .from("discovery_runs")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - RUN_COOLDOWN_MS).toISOString());
  if (count) return json({ error: "A refresh is already running." }, 429);

  const result = await runDiscovery(admin, trip as TripForDiscovery, "manual");
  return json(result, result.status === "error" ? 500 : 200);
});
