// Small fetch helper for the live lookups: a timeout, one clear error, and a short in-memory cache
// so re-screening the same company doesn't spend another paid API call.
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 6 * 60 * 60 * 1000;

export async function getJson<T>(url: string, init: { headers?: Record<string, string>; timeoutMs?: number; cacheKey?: string } = {}): Promise<T | null> {
  const key = init.cacheKey;
  if (key) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T | null;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", ...init.headers }, signal: ctl.signal, cache: "no-store" });
    if (res.status === 404) {
      if (key) cache.set(key, { at: Date.now(), value: null });
      return null;
    }
    if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
    const value = (await res.json()) as T;
    if (key) cache.set(key, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}
