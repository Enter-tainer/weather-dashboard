import { useCallback, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { Settings, X, Plus, Trash2 } from 'lucide-react';
import { parseRoute, stringifyRoute, generate7Days } from '../services/urlParser';
import { reverseGeocode } from '../services/geocoding';
import { updateSearchParams } from '../services/urlState';
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

export default function RouteEditor({ ref }: RouteEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<EditorRouteEntry[]>([]);
  const [quickCity, setQuickCity] = useState('');

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
  }), []);

  // Load existing configuration when opening the modal
  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;

    parseRoute()
      .then(data => {
        if (!cancelled) setEntries(data.map(withEditorId));
      })
      .catch((error: unknown) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleApply = useCallback((newEntries: RouteEntry[]) => {
    const sorted = sortEntriesByDate(newEntries);
    const routeStr = stringifyRoute(sorted);
    updateSearchParams((params) => {
      params.set('route', routeStr);
      params.delete('test');
    }, { history: 'push' });
    window.location.reload();
  }, []);

  const applyQuickMode = useCallback(() => {
    if (!quickCity.trim()) return;
    const newRoute = generate7Days(quickCity.trim(), null, quickCity.trim());
    handleApply(newRoute);
  }, [handleApply, quickCity]);

  const updateEntry = useCallback((id: string, updates: Partial<RouteEntry>) => {
    setEntries(current => current.map(e => e._id === id ? { ...e, ...updates } : e));
  }, []);

  const updateLocation = useCallback((id: string, value: string) => {
    const val = value.trim();
    if (COORD_RE.test(val)) {
      const [lat, lon] = val.split(',').map(Number);
      if (lat == null || lon == null) return;
      const fallbackName = `${lat}°, ${lon}°`;
      updateEntry(id, { lat, lon, city: undefined, originalName: '' });
      reverseGeocode(lat, lon, fallbackName)
        .then(name => {
          setEntries(current => current.map(entry => {
            if (entry._id !== id || entry.lat !== lat || entry.lon !== lon || entry.originalName) {
              return entry;
            }
            return { ...entry, originalName: name };
          }));
        })
        .catch((error: unknown) => {
          console.warn('Reverse geocoding failed:', error);
        });
    } else {
      updateEntry(id, { city: value, lat: undefined, lon: undefined });
    }
  }, [updateEntry]);

  const removeEntry = useCallback((id: string) => {
    setEntries(current => current.filter(e => e._id !== id));
  }, []);

  const updateDateGroup = useCallback((oldDate: string, newDate: string) => {
    setEntries(current => current.map(e => e.date === oldDate ? { ...e, date: newDate } : e));
  }, []);

  const addEntryForDate = useCallback((date: string) => {
    setEntries(current => {
      const group = current.filter(e => e.date === date);
      const lastCity = group.length > 0 ? getEntryLocation(group[group.length - 1] ?? {}) : DEFAULT_CITY;

      return [
        ...current,
        withEditorId({ city: lastCity, originalName: lastCity, date }),
      ];
    });
  }, []);

  const addNewDate = useCallback(() => {
    setEntries(current => {
      let nextDate = new Date().toLocaleDateString('en-CA');
      const sorted = sortEntriesByDate(current);
      const lastEntry = sorted.at(-1);

      if (lastEntry) {
        const lastDate = new Date(lastEntry.date);
        lastDate.setDate(lastDate.getDate() + 1);
        nextDate = lastDate.toLocaleDateString('en-CA');
      }

      const lastCity = lastEntry ? getEntryLocation(lastEntry) : DEFAULT_CITY;
      return [
        ...current,
        withEditorId({ city: lastCity, originalName: lastCity, date: nextDate }),
      ];
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
              <button className="icon-btn" onClick={() => setIsOpen(false)}><X size={20} /></button>
            </div>

            <div className="route-editor-section">
              <h4>快速设置 (未来7天)</h4>
              <div className="quick-set-row">
                <input 
                  type="text" 
                  placeholder="输入城市名，如 Shanghai" 
                  value={quickCity}
                  onChange={e => setQuickCity(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyQuickMode()}
                />
                <button className="primary-btn" onClick={applyQuickMode}>一键应用</button>
              </div>
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
                         onChange={e => updateDateGroup(date, e.target.value)}
                         className="date-input-bold"
                       />
                    </div>
                    {group.map(entry => (
                      <div key={entry._id} className="entry-row">
                        <div className="entry-inputs">
                           <input 
                             type="text" 
                             className="location-input"
                             placeholder="城市 或 纬度,经度" 
                             value={entry.lat != null && entry.lon != null ? `${entry.lat},${entry.lon}` : (entry.city || '')} 
                             onChange={e => updateLocation(entry._id, e.target.value)}
                           />
                           <input 
                             type="text" 
                             className="alias-input"
                             placeholder="显示别名(可选)" 
                             value={entry.originalName || ''} 
                             onChange={e => updateEntry(entry._id, { originalName: e.target.value })}
                           />
                        </div>
                        <button className="icon-btn remove-btn" title="移除此项" onClick={() => removeEntry(entry._id)}><Trash2 size={16} /></button>
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
              <button className="secondary-btn" onClick={() => setIsOpen(false)}>取消</button>
              <button className="primary-btn" onClick={() => handleApply(entries)}>保存并刷新</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
