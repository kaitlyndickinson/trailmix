const BASE = "http://trailmix.invalid";

/** Only allow same-origin relative paths as post-auth redirect targets. */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  // Resolve the way a browser would (which strips tabs/newlines and treats
  // "//host" and "/\host" as other origins), then require the same origin.
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
