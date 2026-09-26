import {
  isResolvableMapsHost,
  parseCoords,
  parseCoordsFromMapsHtml,
  type Coords,
} from "@/lib/maps-link";
import { fetchWithRetry } from "./http";

const MAX_HOPS = 5;
const MAX_HTML_CHARS = 1_000_000;

function allowed(url: URL): boolean {
  return url.protocol === "https:" && isResolvableMapsHost(url.hostname);
}

/**
 * Follows a Google Maps share link (maps.app.goo.gl/…) to the place it points
 * at. Only Google Maps hosts are ever fetched, one redirect at a time, so a
 * pasted link can't make the server request anything else.
 */
export async function resolveMapsShareLink(
  link: string,
): Promise<Coords | null> {
  let url = new URL(link.trim());
  if (!allowed(url)) return null;

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const fromUrl = parseCoords(url.toString());
    if (fromUrl) return fromUrl;

    const res = await fetchWithRetry(url.toString(), { redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, url);
      if (!allowed(next)) return null;
      url = next;
      continue;
    }
    if (!res.ok) return null;

    // Landed on a Maps page whose URL has no coordinates (e.g. ?q=Name&ftid=…);
    // the page's preview image URL usually carries the center.
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    return parseCoordsFromMapsHtml(html);
  }
  return null;
}
