// Edge Functions get Supabase keys as env vars. Projects on the new API keys
// expose them as JSON maps (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS);
// older projects use SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.

function firstKey(jsonVar: string): string | undefined {
  const raw = Deno.env.get(jsonVar);
  if (!raw) return undefined;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    return map.default ?? Object.values(map)[0];
  } catch {
    return undefined;
  }
}

export function supabaseEnv() {
  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    firstKey("SUPABASE_PUBLISHABLE_KEYS");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    firstKey("SUPABASE_SECRET_KEYS");
  if (!url || !publicKey || !serviceKey) {
    throw new Error("Missing Supabase URL or keys in the function environment");
  }
  return { url, publicKey, serviceKey };
}
