// Pull a location out of pasted text: plain "lat, lng", or a Google/Apple Maps
// URL. Short share links (maps.app.goo.gl/…) carry no coordinates, so those
// are resolved on the server first (see locate-actions.ts).

export type Coords = { lat: number; lng: number };

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function valid(lat: number, lng: number): Coords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function first(text: string, patterns: RegExp[]): Coords | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const coords = valid(Number(m[1]), Number(m[2]));
      if (coords) return coords;
    }
  }
  return null;
}

/**
 * Most specific first: a Google place pin (!3d…!4d…) beats the viewport
 * center (@lat,lng), which beats query parameters, which beat any bare pair.
 */
export function parseCoords(text: string): Coords | null {
  let t = text.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    // Not URI-encoded; use as is.
  }
  return first(t, [
    new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
    new RegExp(String.raw`@${NUM},${NUM}`),
    new RegExp(
      String.raw`[?&](?:q|query|ll|sll|destination|daddr|center|coordinate)=${NUM},\s*${NUM}`,
    ),
    new RegExp(String.raw`(?:^|[^\d.])${NUM}\s*,\s*${NUM}(?:$|[^\d])`),
  ]);
}

const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "g.co"]);

/** True for Google share links that need resolving before they have coordinates. */
export function isMapsShortLink(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === "https:" && SHORT_LINK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const RESOLVABLE_HOSTS = [
  /^maps\.app\.goo\.gl$/,
  /^goo\.gl$/,
  /^g\.co$/,
  // google.com, google.de, google.co.uk, google.com.au — nothing after that.
  /^(www\.|maps\.)?google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/,
];

/** Hosts the server may fetch while resolving a share link (SSRF allowlist). */
export function isResolvableMapsHost(hostname: string): boolean {
  return RESOLVABLE_HOSTS.some((re) => re.test(hostname));
}

/**
 * Coordinates embedded in a Google Maps HTML page, for share links that
 * redirect to a place URL without them (e.g. "?q=Place+Name&ftid=…"). The
 * page's preview image URL carries the center as "center=lat%2Clng".
 */
export function parseCoordsFromMapsHtml(html: string): Coords | null {
  return first(html, [
    new RegExp(String.raw`center=${NUM}(?:%2C|,)${NUM}`),
    new RegExp(String.raw`markers=${NUM}(?:%2C|,)${NUM}`),
    new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
    new RegExp(String.raw`/@${NUM},${NUM}`),
  ]);
}

/** Google Maps search for a name, e.g. to check a trailhead before pinning. */
export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
