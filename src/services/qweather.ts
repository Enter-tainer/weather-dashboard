import type {
  MinutelyPrecipitation,
  MinutelyPrecipitationPoint,
  PrecipitationType,
} from '../types/weather';
import { getCached, setCache } from './cache';
import { loadQWeatherCredentials } from './qweatherCredentials';

const MINUTELY_CACHE_TTL_MS = 5 * 60 * 1000;

interface QWeatherMinutelyItem {
  fxTime?: unknown;
  precip?: unknown;
  type?: unknown;
}

interface QWeatherMinutelyResponse {
  code?: unknown;
  updateTime?: unknown;
  fxLink?: unknown;
  summary?: unknown;
  minutely?: unknown;
}

export class QWeatherError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'QWeatherError';
  }
}

function isPrecipitationType(value: unknown): value is PrecipitationType {
  return value === 'rain' || value === 'snow';
}

function parsePoint(item: QWeatherMinutelyItem): MinutelyPrecipitationPoint | null {
  if (typeof item.fxTime !== 'string' || typeof item.precip !== 'string') return null;

  const precip = Number.parseFloat(item.precip);
  if (!Number.isFinite(precip)) return null;

  return {
    fxTime: item.fxTime,
    precip,
    type: isPrecipitationType(item.type) ? item.type : 'rain',
  };
}

export async function fetchMinutelyPrecipitation(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<MinutelyPrecipitation> {
  const credentials = loadQWeatherCredentials();
  if (!credentials) {
    throw new QWeatherError('请先在设置中填写自己的和风天气 API Key 和 API Host', 'CONFIG');
  }

  const url = new URL(`https://${credentials.apiHost}/v7/minutely/5m`);
  url.searchParams.set('location', `${longitude.toFixed(2)},${latitude.toFixed(2)}`);
  url.searchParams.set('lang', 'zh');
  const cacheKey = `qweather-minutely:${url.toString()}`;
  const cached = getCached<MinutelyPrecipitation>(cacheKey);
  if (cached && Array.isArray(cached.points)) return cached;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'X-QW-Api-Key': credentials.apiKey },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new QWeatherError('无法连接和风天气，请检查 API Host 或网络设置', 'NETWORK');
  }
  const payload = (await response.json().catch(() => null)) as QWeatherMinutelyResponse | null;
  const code = typeof payload?.code === 'string' ? payload.code : undefined;

  if (!response.ok || code !== '200') {
    throw new QWeatherError(
      code === '401'
        ? '和风天气凭证无效，请在设置中检查 API Key 和 API Host'
        : '暂时无法获取该地点的分钟级降水',
      code,
    );
  }

  if (!payload) throw new QWeatherError('分钟级降水返回了无效数据');

  const rawItems = Array.isArray(payload.minutely)
    ? (payload.minutely as QWeatherMinutelyItem[])
    : [];

  const result: MinutelyPrecipitation = {
    updateTime: typeof payload.updateTime === 'string' ? payload.updateTime : '',
    fxLink: typeof payload.fxLink === 'string' ? payload.fxLink : 'https://www.qweather.com',
    summary: typeof payload.summary === 'string' ? payload.summary : '暂无降水描述',
    points: rawItems
      .map(parsePoint)
      .filter((item): item is MinutelyPrecipitationPoint => item != null),
  };
  setCache(cacheKey, result, MINUTELY_CACHE_TTL_MS);
  return result;
}
