const cache = new Map();

const TTL_GEO = 60 * 60 * 1000;      // 1 hour for geocoding
const TTL_WEATHER = 10 * 60 * 1000;   // 10 minutes for weather data

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttl) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

export async function cachedFetch(url, ttl) {
  const cached = getCached(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  setCache(url, data, ttl);
  return data;
}

export { TTL_GEO, TTL_WEATHER };
