// Shared fetch for external sources: timeout, one retry with backoff, and a
// User-Agent with a contact address (required by Overpass/Nominatim policy).

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_BACKOFF_MS = 1_500;

export class HttpError extends Error {
  constructor(
    public readonly source: string,
    public readonly status: number,
    message: string,
  ) {
    super(`${source}: ${message}`);
  }
}

export function userAgent(): string {
  const contact = Deno.env.get("OSM_CONTACT_EMAIL") ?? "unset";
  return `Trailmix/0.1 (hike planner; contact: ${contact})`;
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchJson(
  source: string,
  url: string,
  init: RequestInit & { timeoutMs?: number; retry?: boolean } = {},
): Promise<unknown> {
  // retry: false lets a caller with fallbacks (Overpass mirrors) move on
  // instead of waiting out a backoff on a server that just failed.
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retry = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("User-Agent", userAgent());
  headers.set("Accept", "application/json");

  let lastError: unknown;
  const attempts = retry ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    try {
      const res = await fetch(url, {
        ...rest,
        headers,
        signal: rest.signal
          ? AbortSignal.any([rest.signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.json();
      // Error pages are often HTML; keep a short, readable excerpt for stats.
      const body = (await res.text())
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      lastError = new HttpError(source, res.status, `HTTP ${res.status} ${body}`);
      if (!isRetryable(res.status)) break;
    } catch (err) {
      // Network error or timeout: retry once.
      lastError = err instanceof Error
        ? new HttpError(source, 0, err.message)
        : new HttpError(source, 0, String(err));
    }
  }
  throw lastError;
}
