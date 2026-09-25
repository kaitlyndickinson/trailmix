/** Pulls "lat, lng" out of pasted text: plain coords or a Google/Apple Maps link. */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const match = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Accepts "alltrails.com/trail/..." as well as full URLs. Empty → null. */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** "2026-09-26" → "Sat, Sep 26". Parsed as a local calendar date, not UTC. */
export function formatTripDate(
  isoDate: string,
  opts: { withYear?: boolean } = {},
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(opts.withYear ? { year: "numeric" } : {}),
  });
}

/** Today's date in the viewer's local timezone, as YYYY-MM-DD. */
export function localToday(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
