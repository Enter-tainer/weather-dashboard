import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedFetch, getCached, setCache } from './cache';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolveFn: Deferred<T>['resolve'] | undefined;
  let rejectFn: Deferred<T>['reject'] | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  if (!resolveFn || !rejectFn) throw new Error('Failed to create deferred');
  return { promise, resolve: resolveFn, reject: rejectFn };
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('cache storage helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('returns cached values until their TTL expires', () => {
    setCache('key', { ok: true }, 1000);

    expect(getCached('key')).toEqual({ ok: true });

    vi.advanceTimersByTime(1001);

    expect(getCached('key')).toBeNull();
    expect(localStorage.getItem('weather_cache:key')).toBeNull();
  });

  it('removes malformed cache entries', () => {
    localStorage.setItem('weather_cache:bad', JSON.stringify({ value: 'missing expiry' }));

    expect(getCached('bad')).toBeNull();
    expect(localStorage.getItem('weather_cache:bad')).toBeNull();
  });
});

describe('cachedFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00Z'));
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('fetches, caches, and reuses successful JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ temp: 21 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cachedFetch('https://example.test/weather', 1000)).resolves.toEqual({ temp: 21 });
    await expect(cachedFetch('https://example.test/weather', 1000)).resolves.toEqual({ temp: 21 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for non-ok responses without caching them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: true }, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cachedFetch('https://example.test/fail', 1000)).resolves.toBeNull();
    await expect(cachedFetch('https://example.test/fail', 1000)).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries 429 responses using Retry-After before caching the successful retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 429,
          headers: { 'Retry-After': '2' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = cachedFetch('https://example.test/retry', 1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits concurrent network requests and drains queued fetches', async () => {
    const responses = Array.from({ length: 5 }, () => deferred<Response>());
    const fetchMock = vi.fn((url: string) => {
      const index = Number(url.at(-1));
      const response = responses[index];
      if (!response) throw new Error(`Unexpected URL ${url}`);
      return response.promise;
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = [0, 1, 2, 3, 4].map((index) =>
      cachedFetch<{ index: number }>(`https://example.test/${index}`, 1000),
    );

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    responses[0]?.resolve(jsonResponse({ index: 0 }));
    await expect(results[0]).resolves.toEqual({ index: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    responses[1]?.resolve(jsonResponse({ index: 1 }));
    responses[2]?.resolve(jsonResponse({ index: 2 }));
    responses[3]?.resolve(jsonResponse({ index: 3 }));
    responses[4]?.resolve(jsonResponse({ index: 4 }));

    await expect(Promise.all(results)).resolves.toEqual([
      { index: 0 },
      { index: 1 },
      { index: 2 },
      { index: 3 },
      { index: 4 },
    ]);
  });
});
