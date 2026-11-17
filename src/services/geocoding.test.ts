import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCitySubtitle, getCityDetails, searchCities, type GeoCandidate } from './geocoding';

function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});

const hangzhou = {
  name: '杭州',
  latitude: 30.29365,
  longitude: 120.16142,
  timezone: 'Asia/Shanghai',
  country: '中国',
  admin1: '浙江',
  admin2: '杭州市',
  elevation: 42,
};

describe('searchCities', () => {
  it('requests Chinese names with language=zh so 中文 queries resolve', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [hangzhou] }));

    await searchCities('杭州', 5);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('language=zh');
    expect(url).toContain('count=5');
    expect(url).toContain(`name=${encodeURIComponent('杭州')}`);
  });

  it('returns admin context and caches the query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [hangzhou] }));

    const first = await searchCities('杭州');
    const second = await searchCities('杭州');

    expect(first[0]).toMatchObject({
      name: '杭州',
      latitude: 30.29365,
      admin1: '浙江',
      admin2: '杭州市',
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips the network for blank queries', async () => {
    await expect(searchCities('   ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the geocoding endpoint fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);

    await expect(searchCities('杭州')).rejects.toThrow('Geocoding failed: 503');
  });
});

describe('getCityDetails', () => {
  it('resolves Chinese city names and keeps the IANA timezone', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [hangzhou] }));

    const details = await getCityDetails('杭州');

    expect(details).toEqual({
      latitude: 30.29365,
      longitude: 120.16142,
      timezone: 'Asia/Shanghai',
      name: '杭州',
    });
  });

  it('falls back to timezone=auto when the payload omits it', async () => {
    const { timezone: _timezone, ...withoutTimezone } = hangzhou;
    fetchMock.mockResolvedValue(jsonResponse({ results: [withoutTimezone] }));

    await expect(getCityDetails('杭州')).resolves.toMatchObject({ timezone: 'auto' });
  });

  it('throws for unknown places', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

    await expect(getCityDetails('不存在的地方')).rejects.toThrow('City not found');
  });
});

describe('formatCitySubtitle', () => {
  const candidate = (overrides: Partial<GeoCandidate>): GeoCandidate => ({
    name: 'X',
    latitude: 0,
    longitude: 0,
    ...overrides,
  });

  it('drops the admin level that just repeats the city name', () => {
    expect(formatCitySubtitle(candidate({ name: '杭州', admin2: '杭州市', admin1: '浙江' }))).toBe(
      '浙江',
    );
  });

  it('keeps the disambiguating district for duplicate names', () => {
    expect(formatCitySubtitle(candidate({ name: '朝阳', admin2: '北京市', admin1: '北京' }))).toBe(
      '北京',
    );
  });

  it('keeps a municipality once when both admin levels are the same', () => {
    expect(
      formatCitySubtitle(candidate({ name: '巫山', admin1: '重庆市', admin2: '重庆市' })),
    ).toBe('重庆市');
  });

  it('reads like an address: province before prefecture', () => {
    expect(
      formatCitySubtitle(candidate({ name: '党岭', admin1: '四川', admin2: '甘孜藏族自治州' })),
    ).toBe('四川 · 甘孜藏族自治州');
  });

  it('falls back to the country when there is no admin context', () => {
    expect(formatCitySubtitle(candidate({ name: 'Tokyo', country: '日本' }))).toBe('日本');
  });

  it('keeps the country for foreign namesakes', () => {
    expect(
      formatCitySubtitle(candidate({ name: '巫山', admin1: 'Kangwŏn-do', country: '朝鲜' })),
    ).toBe('朝鲜 · Kangwŏn-do');
    expect(formatCitySubtitle(candidate({ name: '杭州', admin1: '浙江', country: '中国' }))).toBe(
      '浙江',
    );
  });
});
