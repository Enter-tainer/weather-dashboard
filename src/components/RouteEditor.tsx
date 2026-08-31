import { useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { CloudRain, Eye, EyeOff, Settings, X, Plus, Trash2 } from 'lucide-react';
import { parseRoute, stringifyRoute, generate7Days } from '../services/urlParser';
import { reverseGeocode } from '../services/geocoding';
import { updateSearchParams } from '../services/urlState';
import {
  clearQWeatherCredentials,
  loadQWeatherCredentials,
  saveQWeatherCredentials,
} from '../services/qweatherCredentials';
import type { RouteEntry } from '../types/weather';
import './RouteEditor.css';

const COORD_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
const DEFAULT_CITY = 'Beijing';

interface EditorRouteEntry extends RouteEntry {
  _id: string;
}

export interface RouteEditorHandle {
  open: () => void;
}

interface RouteEditorProps {
  ref?: Ref<RouteEditorHandle>;
  einkMode?: boolean;
  onEinkModeChange?: (enabled: boolean) => void;
  readerLayout?: boolean;
  onReaderLayoutChange?: (enabled: boolean) => void;
  immersiveMode?: boolean;
  onImmersiveModeChange?: (enabled: boolean) => void;
}

function createEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function withEditorId(entry: RouteEntry): EditorRouteEntry {
  return { ...entry, _id: createEntryId() };
}

function sortEntriesByDate<T extends RouteEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function getEntryLocation(entry: Partial<RouteEntry>): string {
  return entry.city || entry.originalName || DEFAULT_CITY;
}

function groupEntriesByDate(entries: EditorRouteEntry[]): Array<[string, EditorRouteEntry[]]> {
  const groups = new Map<string, EditorRouteEntry[]>();

  for (const entry of entries) {
    if (!groups.has(entry.date)) groups.set(entry.date, []);
    groups.get(entry.date)?.push(entry);
  }

  return [...groups.entries()].sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
}

export default function RouteEditor({
  ref,
  einkMode = false,
  onEinkModeChange,
  readerLayout = false,
  onReaderLayoutChange,
  immersiveMode = false,
  onImmersiveModeChange,
}: RouteEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<EditorRouteEntry[]>([]);
  const [quickCity, setQuickCity] = useState('');
  const [qweatherApiKey, setQweatherApiKey] = useState('');
  const [qweatherApiHost, setQweatherApiHost] = useState('');
  const [rememberQWeather, setRememberQWeather] = useState(false);
  const [showQWeatherKey, setShowQWeatherKey] = useState(false);
  const [qweatherStatus, setQweatherStatus] = useState<
    { kind: 'idle' | 'success' | 'error'; message: string } | undefined
  >();

  useImperativeHandle(
    ref,
    () => ({
      open: () => setIsOpen(true),
    }),
    [],
  );

  // Load existing configuration when opening the modal
  useEffect(() => {
    if (!isOpen) return undefined;

    const credentials = loadQWeatherCredentials();
    setQweatherApiKey(credentials?.apiKey ?? '');
    setQweatherApiHost(credentials?.apiHost ?? '');
    setRememberQWeather(credentials?.persistent ?? false);
    setShowQWeatherKey(false);
    setQweatherStatus(
      credentials
        ? { kind: 'success', message: '已配置，可点击当前两小时的降水图标测试' }
        : { kind: 'idle', message: '尚未配置' },
    );

    let cancelled = false;

    parseRoute()
      .then((data) => {
        if (!cancelled) setEntries(data.map(withEditorId));
      })
      .catch((error: unknown) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const saveQWeather = useCallback(() => {
    try {
      saveQWeatherCredentials(
        { apiKey: qweatherApiKey, apiHost: qweatherApiHost },
        rememberQWeather,
      );
      setQweatherStatus({
        kind: 'success',
        message: rememberQWeather ? '已保存在此浏览器' : '已保存到本次浏览器会话',
      });
    } catch (error) {
      setQweatherStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : '无法保存和风天气凭证',
      });
    }
  }, [qweatherApiHost, qweatherApiKey, rememberQWeather]);

  const clearQWeather = useCallback(() => {
    clearQWeatherCredentials();
    setQweatherApiKey('');
    setQweatherApiHost('');
    setRememberQWeather(false);
    setQweatherStatus({ kind: 'idle', message: '已清除浏览器中的和风天气凭证' });
  }, []);

  const handleApply = useCallback((newEntries: RouteEntry[]) => {
    const sorted = sortEntriesByDate(newEntries);
    const routeStr = stringifyRoute(sorted);
    updateSearchParams(
      (params) => {
        params.set('route', routeStr);
        params.delete('test');
      },
      { history: 'push' },
    );
    window.location.reload();
  }, []);

  const applyQuickMode = useCallback(() => {
    if (!quickCity.trim()) return;
    const newRoute = generate7Days(quickCity.trim(), null, quickCity.trim());
    handleApply(newRoute);
  }, [handleApply, quickCity]);

  const updateEntry = useCallback((id: string, updates: Partial<RouteEntry>) => {
    setEntries((current) => current.map((e) => (e._id === id ? { ...e, ...updates } : e)));
  }, []);

  const updateLocation = useCallback(
    (id: string, value: string) => {
      const val = value.trim();
      if (COORD_RE.test(val)) {
        const [lat, lon] = val.split(',').map(Number);
        if (lat == null || lon == null) return;
        const fallbackName = `${lat}°, ${lon}°`;
        updateEntry(id, { lat, lon, city: undefined, originalName: '' });
        reverseGeocode(lat, lon, fallbackName)
          .then((name) => {
            setEntries((current) =>
              current.map((entry) => {
                if (
                  entry._id !== id ||
                  entry.lat !== lat ||
                  entry.lon !== lon ||
                  entry.originalName
                ) {
                  return entry;
                }
                return { ...entry, originalName: name };
              }),
            );
          })
          .catch((error: unknown) => {
            console.warn('Reverse geocoding failed:', error);
          });
      } else {
        updateEntry(id, { city: value, lat: undefined, lon: undefined });
      }
    },
    [updateEntry],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((e) => e._id !== id));
  }, []);

  const updateDateGroup = useCallback((oldDate: string, newDate: string) => {
    setEntries((current) => current.map((e) => (e.date === oldDate ? { ...e, date: newDate } : e)));
  }, []);

  const addEntryForDate = useCallback((date: string) => {
    setEntries((current) => {
      const group = current.filter((e) => e.date === date);
      const lastCity =
        group.length > 0 ? getEntryLocation(group[group.length - 1] ?? {}) : DEFAULT_CITY;

      return [...current, withEditorId({ city: lastCity, originalName: lastCity, date })];
    });
  }, []);

  const addNewDate = useCallback(() => {
    setEntries((current) => {
      let nextDate = new Date().toLocaleDateString('en-CA');
      const sorted = sortEntriesByDate(current);
      const lastEntry = sorted.at(-1);

      if (lastEntry) {
        const lastDate = new Date(lastEntry.date);
        lastDate.setDate(lastDate.getDate() + 1);
        nextDate = lastDate.toLocaleDateString('en-CA');
      }

      const lastCity = lastEntry ? getEntryLocation(lastEntry) : DEFAULT_CITY;
      return [...current, withEditorId({ city: lastCity, originalName: lastCity, date: nextDate })];
    });
  }, []);

  const dateGroups = useMemo(() => groupEntriesByDate(entries), [entries]);

  return (
    <>
      <button
        className="route-editor-btn"
        onClick={() => setIsOpen(true)}
        title="Settings & Route Editor"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className="route-editor-overlay">
          <div className="route-editor-modal">
            <div className="route-editor-header">
              <h3>设置城市与路线</h3>
              <button className="icon-btn" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="route-editor-section">
              <h4>快速设置 (未来7天)</h4>
              <div className="quick-set-row">
                <input
                  type="text"
                  placeholder="输入城市名，如 Shanghai"
                  value={quickCity}
                  onChange={(e) => setQuickCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyQuickMode()}
                />
                <button className="primary-btn" onClick={applyQuickMode}>
                  一键应用
                </button>
              </div>
            </div>

            <div className="route-editor-section display-settings">
              <h4>显示设置</h4>
              <label className="display-setting-row">
                <input
                  type="checkbox"
                  checked={einkMode}
                  onChange={(event) => onEinkModeChange?.(event.target.checked)}
                />
                <span>
                  墨水屏模式
                  <small>使用纯黑白显示；同步 URL 参数 display=eink</small>
                </span>
              </label>
              <label className="display-setting-row">
                <input
                  type="checkbox"
                  checked={readerLayout}
                  onChange={(event) => onReaderLayoutChange?.(event.target.checked)}
                />
                <span>
                  阅读布局
                  <small>加大字号和图表，横竖屏自动适配；同步 URL 参数 layout=reader</small>
                </span>
              </label>
              <label className="display-setting-row">
                <input
                  type="checkbox"
                  checked={immersiveMode}
                  onChange={(event) => onImmersiveModeChange?.(event.target.checked)}
                />
                <span>
                  沉浸显示
                  <small>隐藏浮动工具；也可使用 URL 参数 immersive=true</small>
                </span>
              </label>
            </div>

            <div className="route-editor-section qweather-settings">
              <h4>
                <CloudRain size={14} aria-hidden="true" /> 和风天气分钟降水 (BYOK)
              </h4>
              <p className="qweather-settings-description">
                凭证只保存在你的浏览器，并由浏览器直接发送给和风天气。本项目不会接收或转发它。
              </p>
              <label className="qweather-field">
                <span>专属 API Host</span>
                <input
                  type="text"
                  value={qweatherApiHost}
                  placeholder="abcxyz.qweatherapi.com"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(event) => {
                    setQweatherApiHost(event.target.value);
                    setQweatherStatus(undefined);
                  }}
                />
              </label>
              <label className="qweather-field">
                <span>API Key</span>
                <span className="qweather-key-input">
                  <input
                    type={showQWeatherKey ? 'text' : 'password'}
                    value={qweatherApiKey}
                    placeholder="输入你自己的 API Key"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                      setQweatherApiKey(event.target.value);
                      setQweatherStatus(undefined);
                    }}
                  />
                  <button
                    type="button"
                    className="qweather-key-toggle"
                    onClick={() => setShowQWeatherKey((shown) => !shown)}
                    aria-label={showQWeatherKey ? '隐藏 API Key' : '显示 API Key'}
                  >
                    {showQWeatherKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
              </label>
              <label className="qweather-remember">
                <input
                  type="checkbox"
                  checked={rememberQWeather}
                  onChange={(event) => setRememberQWeather(event.target.checked)}
                />
                <span>
                  记住在此浏览器
                  <small>使用 localStorage；共享设备或不受信任页面建议关闭</small>
                </span>
              </label>
              <div className="qweather-actions">
                <button type="button" className="secondary-btn" onClick={clearQWeather}>
                  清除凭证
                </button>
                <button type="button" className="primary-btn" onClick={saveQWeather}>
                  保存凭证
                </button>
              </div>
              {qweatherStatus && (
                <div
                  className={`qweather-status is-${qweatherStatus.kind}`}
                  role={qweatherStatus.kind === 'error' ? 'alert' : 'status'}
                >
                  {qweatherStatus.message}
                </div>
              )}
            </div>

            <div className="route-editor-section">
              <h4>高级模式 (多段行程拼接)</h4>
              <div className="entries-list">
                {dateGroups.map(([date, group]) => (
                  <div key={date} className="date-group">
                    <div className="date-header">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => updateDateGroup(date, e.target.value)}
                        className="date-input-bold"
                      />
                    </div>
                    {group.map((entry) => (
                      <div key={entry._id} className="entry-row">
                        <div className="entry-inputs">
                          <input
                            type="text"
                            className="location-input"
                            placeholder="城市 或 纬度,经度"
                            value={
                              entry.lat != null && entry.lon != null
                                ? `${entry.lat},${entry.lon}`
                                : entry.city || ''
                            }
                            onChange={(e) => updateLocation(entry._id, e.target.value)}
                          />
                          <input
                            type="text"
                            className="alias-input"
                            placeholder="显示别名(可选)"
                            value={entry.originalName || ''}
                            onChange={(e) =>
                              updateEntry(entry._id, { originalName: e.target.value })
                            }
                          />
                        </div>
                        <button
                          className="icon-btn remove-btn"
                          title="移除此项"
                          onClick={() => removeEntry(entry._id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button className="add-small-btn" onClick={() => addEntryForDate(date)}>
                      <Plus size={14} /> 添加同日对比城市
                    </button>
                  </div>
                ))}
              </div>
              <button className="add-btn" onClick={addNewDate}>
                <Plus size={16} /> 添加新的一天
              </button>
            </div>

            <div className="route-editor-footer">
              <button className="secondary-btn" onClick={() => setIsOpen(false)}>
                取消
              </button>
              <button className="primary-btn" onClick={() => handleApply(entries)}>
                保存并刷新
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
