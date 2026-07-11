export interface QWeatherCredentials {
  apiKey: string;
  apiHost: string;
}

export interface StoredQWeatherCredentials extends QWeatherCredentials {
  persistent: boolean;
}

const STORAGE_KEY = 'weather-dashboard:qweather-credentials';
const HOST_PATTERN = /^[a-z0-9.-]+\.qweatherapi\.com$/i;

function getStorage(persistent: boolean): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return persistent ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function normalizeQWeatherHost(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

export function validateQWeatherCredentials(credentials: QWeatherCredentials): QWeatherCredentials {
  const apiKey = credentials.apiKey.trim();
  const apiHost = normalizeQWeatherHost(credentials.apiHost);

  if (!apiKey) throw new Error('请输入和风天气 API Key');
  if (!HOST_PATTERN.test(apiHost)) {
    throw new Error('请输入有效的专属 API Host，例如 abcxyz.qweatherapi.com');
  }

  return { apiKey, apiHost };
}

function readStorage(
  storage: Storage | null,
  persistent: boolean,
): StoredQWeatherCredentials | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QWeatherCredentials>;
    if (typeof parsed.apiKey !== 'string' || typeof parsed.apiHost !== 'string') return null;
    return { ...validateQWeatherCredentials(parsed as QWeatherCredentials), persistent };
  } catch {
    return null;
  }
}

export function loadQWeatherCredentials(): StoredQWeatherCredentials | null {
  return readStorage(getStorage(false), false) ?? readStorage(getStorage(true), true);
}

export function saveQWeatherCredentials(
  credentials: QWeatherCredentials,
  persistent: boolean,
): StoredQWeatherCredentials {
  const normalized = validateQWeatherCredentials(credentials);
  const target = getStorage(persistent);
  if (!target) throw new Error('当前浏览器不允许保存凭证');

  target.setItem(STORAGE_KEY, JSON.stringify(normalized));
  getStorage(!persistent)?.removeItem(STORAGE_KEY);
  return { ...normalized, persistent };
}

export function clearQWeatherCredentials(): void {
  getStorage(false)?.removeItem(STORAGE_KEY);
  getStorage(true)?.removeItem(STORAGE_KEY);
}
