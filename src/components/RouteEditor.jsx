import { useState, useEffect } from 'react';
import { Settings, X, Plus, Trash2, MapPin } from 'lucide-react';
import { parseRoute, stringifyRoute, generate7Days } from '../services/urlParser';
import './RouteEditor.css';

const COORD_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export default function RouteEditor() {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [quickCity, setQuickCity] = useState('');

  // Load existing configuration when opening the modal
  useEffect(() => {
    if (isOpen) {
      parseRoute().then(data => {
        setEntries(data.map(d => ({ ...d, _id: Math.random().toString(36) })));
      }).catch(e => console.error(e));
    }
  }, [isOpen]);

  const handleApply = (newEntries) => {
    // Sort before applying
    const sorted = [...newEntries].sort((a,b) => a.date > b.date ? 1 : (a.date < b.date ? -1 : 0));
    const routeStr = stringifyRoute(sorted);
    const url = new URL(window.location);
    url.searchParams.set('route', routeStr);
    url.searchParams.delete('test'); // Clean up test if any
    window.history.pushState({}, '', url.toString());
    window.location.reload(); // Quick refresh to apply new route
  };

  const applyQuickMode = () => {
    if (!quickCity.trim()) return;
    const newRoute = generate7Days(quickCity.trim(), null, quickCity.trim());
    handleApply(newRoute);
  };

  const updateEntry = (id, updates) => {
    setEntries(entries.map(e => e._id === id ? { ...e, ...updates } : e));
  };

  const updateLocation = (id, value) => {
    const val = value.trim();
    if (COORD_RE.test(val)) {
      const [lat, lon] = val.split(',').map(Number);
      updateEntry(id, { lat, lon, city: undefined });
    } else {
      updateEntry(id, { city: value, lat: undefined, lon: undefined });
    }
  };

  const removeEntry = (id) => {
    setEntries(entries.filter(e => e._id !== id));
  };

  const updateDateGroup = (oldDate, newDate) => {
    setEntries(entries.map(e => e.date === oldDate ? { ...e, date: newDate } : e));
  };

  const addEntryForDate = (date) => {
    const group = entries.filter(e => e.date === date);
    const lastCity = group.length > 0 ? (group[group.length-1].city || group[group.length-1].originalName) : 'Beijing';
    setEntries([...entries, { city: lastCity, originalName: lastCity, date, _id: Math.random().toString(36) }]);
  };

  const addNewDate = () => {
    let nextDate = new Date().toLocaleDateString('en-CA');
    if (entries.length > 0) {
      const sorted = [...entries].sort((a,b) => a.date > b.date ? 1 : -1);
      const lastDate = new Date(sorted[sorted.length - 1].date);
      lastDate.setDate(lastDate.getDate() + 1);
      nextDate = lastDate.toLocaleDateString('en-CA');
    }
    const sorted = [...entries].sort((a,b) => a.date > b.date ? 1 : -1);
    const lastCity = sorted.length > 0 ? (sorted[sorted.length-1].city || sorted[sorted.length-1].originalName) : 'Beijing';
    setEntries([...entries, { city: lastCity, originalName: lastCity, date: nextDate, _id: Math.random().toString(36) }]);
  };

  const groupedDates = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedDates).sort((a,b) => (a>b?1:(a<b?-1:0)));

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
                {sortedDates.map(date => (
                  <div key={date} className="date-group">
                    <div className="date-header">
                       <input 
                         type="date" 
                         value={date}
                         onChange={e => updateDateGroup(date, e.target.value)}
                         className="date-input-bold"
                       />
                    </div>
                    {groupedDates[date].map(entry => (
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
