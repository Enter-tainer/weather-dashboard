const STORAGE_PREFIX = 'weather_cache:';

const TTL_GEO = 60 * 60 * 1000;      // 1 hour for geocoding
const TTL_WEATHER = 10 * 60 * 1000;   // 10 minutes for weather data

// --- localStorage-backed cache ---

function storageKey(key) {
  return STORAGE_PREFIX + key;
}

export function getCached(key) {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expires) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function setCache(key, value, ttl) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify({
      value,
      expires: Date.now() + ttl,
    }));
  } catch {
    // localStorage full — evict expired entries and retry once
    evictExpired();
    try {
      localStorage.setItem(storageKey(key), JSON.stringify({
        value,
        expires: Date.now() + ttl,
      }));
    } catch {
      // still full, silently skip
    }
  }
}

function evictExpired() {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(k));
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
const queue = [];

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    drain();
  });
}

function drain() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const { fn, resolve, reject } = queue.shift();
    activeCount++;
    fn().then(resolve, reject).finally(() => {
      activeCount--;
      drain();
    });
  }
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(`429 on ${url.slice(0, 80)}…, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  // Last attempt — return whatever we get
  return fetch(url);
}

export async function cachedFetch(url, ttl) {
  const cached = getCached(url);
  if (cached) return cached;

  return enqueue(async () => {
    // Re-check cache — another queued request for the same URL may have resolved
    const cached2 = getCached(url);
    if (cached2) return cached2;

    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const data = await res.json();
    setCache(url, data, ttl);
    return data;
  });
}

export { TTL_GEO, TTL_WEATHER };
