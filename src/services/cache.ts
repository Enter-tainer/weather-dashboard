const STORAGE_PREFIX = 'weather_cache:';

const TTL_GEO = 60 * 60 * 1000; // 1 hour for geocoding
const TTL_WEATHER = 10 * 60 * 1000; // 10 minutes for weather data

// --- localStorage-backed cache ---

interface CacheEntry<T> {
  value: T;
  expires: number;
}

function isCacheEntry(value: unknown): value is CacheEntry<unknown> {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as { expires?: unknown; value?: unknown };
  return typeof candidate.expires === 'number' && 'value' in candidate;
}

function storageKey(key: string): string {
  return STORAGE_PREFIX + key;
}

export function getCached<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry: unknown = JSON.parse(raw);
    if (!isCacheEntry(entry)) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    if (Date.now() > entry.expires) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    return entry.value as T;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, value: T, ttl: number): void {
  try {
    localStorage.setItem(
      storageKey(key),
      JSON.stringify({
        value,
        expires: Date.now() + ttl,
      }),
    );
  } catch {
    // localStorage full — evict expired entries and retry once
    evictExpired();
    try {
      localStorage.setItem(
        storageKey(key),
        JSON.stringify({
          value,
          expires: Date.now() + ttl,
        }),
      );
    } catch {
      // still full, silently skip
    }
  }
}

function evictExpired(): void {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(k);
      if (raw == null) continue;
      const entry: unknown = JSON.parse(raw);
      if (!isCacheEntry(entry)) {
        localStorage.removeItem(k);
        continue;
      }
      if (now > entry.expires) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}

// --- Rate limiter + 429 backoff fetch ---

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

let activeCount = 0;
const queue: Array<() => void> = [];

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      activeCount++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeCount--;
          drain();
        });
    });
    drain();
  });
}

function drain(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const run = queue.shift();
    if (!run) return;
    run();
  }
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(
        `429 on ${url.slice(0, 80)}…, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`,
      );
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, waitMs);
      });
      continue;
    }
    return res;
  }
  // Last attempt — return whatever we get
  return fetch(url);
}

export async function cachedFetch<T = unknown>(url: string, ttl: number): Promise<T | null> {
  const cached = getCached<T>(url);
  if (cached) return cached;

  return enqueue(async () => {
    // Re-check cache — another queued request for the same URL may have resolved
    const cached2 = getCached<T>(url);
    if (cached2) return cached2;

    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    setCache(url, data, ttl);
    return data;
  });
}

export { TTL_GEO, TTL_WEATHER };
