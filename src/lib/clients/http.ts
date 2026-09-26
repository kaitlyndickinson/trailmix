// Server-side fetch for external sources (imported only from server actions):
// timeout, one retry with backoff, and a User-Agent with a contact address,
// which OpenStreetMap-based services ask for.

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = 1_000;

export function userAgent(): string {
  const contact = process.env.OSM_CONTACT_EMAIL ?? "unset";
  return `Trailmix/0.1 (hike planner; contact: ${contact})`;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("User-Agent", userAgent());

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    try {
      const res = await fetch(url, {
        ...rest,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status !== 429 && res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
