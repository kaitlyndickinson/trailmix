// National Weather Service alerts (api.weather.gov), filtered to the ones that
// overlap the hike day. Pure: the client fetches, this decides.

export type WeatherAlert = {
  id: string;
  event: string; // "Flood Watch", "Red Flag Warning", …
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  headline: string | null;
  starts: string | null; // ISO with offset
  ends: string | null;
  instruction: string | null;
  area: string | null;
};

type NwsFeature = {
  id?: string;
  properties?: {
    id?: string;
    event?: string;
    severity?: string;
    status?: string;
    messageType?: string;
    headline?: string | null;
    onset?: string | null;
    effective?: string | null;
    sent?: string | null;
    ends?: string | null;
    expires?: string | null;
    instruction?: string | null;
    areaDesc?: string | null;
  };
};

const SEVERITY_ORDER = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const;
const MAX_INSTRUCTION_CHARS = 400;

function severity(s: string | undefined): WeatherAlert["severity"] {
  return (SEVERITY_ORDER as readonly string[]).includes(s ?? "")
    ? (s as WeatherAlert["severity"])
    : "Unknown";
}

/**
 * Alerts overlapping the trip date at the trailhead. `utcOffsetSeconds` is the
 * trailhead's offset (from the forecast) so the day's bounds are local.
 */
export function alertsForDay(
  json: unknown,
  isoDate: string,
  utcOffsetSeconds: number,
): WeatherAlert[] {
  const features = (json as { features?: NwsFeature[] })?.features ?? [];
  const [y, m, d] = isoDate.split("-").map(Number);
  const dayStart = Date.UTC(y, m - 1, d) - utcOffsetSeconds * 1000;
  const dayEnd = dayStart + 86_400_000;
  const seen = new Set<string>();
  const out: WeatherAlert[] = [];

  for (const f of features) {
    const p = f.properties ?? {};
    if (p.status && p.status !== "Actual") continue; // skip tests/exercises
    if (p.messageType === "Cancel") continue;
    const startIso = p.onset ?? p.effective ?? p.sent ?? null;
    const endIso = p.ends ?? p.expires ?? null;
    const start = startIso ? Date.parse(startIso) : -Infinity;
    const end = endIso ? Date.parse(endIso) : Infinity;
    if (!(start < dayEnd && end > dayStart)) continue;

    // The same watch is often re-issued by neighboring offices; show it once.
    const key = `${p.event}|${p.ends ?? p.expires}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const instruction = p.instruction?.replace(/\s+/g, " ").trim() || null;
    out.push({
      id: p.id ?? f.id ?? key,
      event: p.event ?? "Weather alert",
      severity: severity(p.severity),
      headline: p.headline ?? null,
      starts: startIso,
      ends: p.ends ?? null,
      instruction: instruction && instruction.length > MAX_INSTRUCTION_CHARS
        ? `${instruction.slice(0, MAX_INSTRUCTION_CHARS - 1)}…`
        : instruction,
      area: p.areaDesc ?? null,
    });
  }

  return out.sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
