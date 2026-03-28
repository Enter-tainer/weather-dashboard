import { useMemo, useState, useRef, useEffect, useCallback, createRef } from 'react';
import './Dashboard.css';
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudRainWind, CloudSnow, CloudHail, CloudLightning, CloudSunRain, CloudMoonRain, HelpCircle } from 'lucide-react';

const WEATHER_NAMES = {
  0: '晴', 1: '少云', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  56: '冻毛毛雨', 57: '强冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '强冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '小阵雨', 81: '中阵雨', 82: '强阵雨',
  85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴+冰雹', 99: '强雷暴+冰雹',
};

function getWeatherIcon(code, isNight, size = 18) {
  const props = { size, color: '#444' };

  if (code === 0) return isNight ? <Moon {...props} color="#64748b" /> : <Sun {...props} color="#e69c00" />;
  if (code === 1) return isNight ? <CloudMoon {...props} color="#64748b" /> : <CloudSun {...props} color="#deba37" />;
  if (code === 2) return <Cloud {...props} color={isNight ? "#64748b" : "#888"} />;
  if (code === 3) return <Cloud {...props} color={isNight ? "#475569" : "#666"} />;
  if ([45, 48].includes(code)) return <CloudFog {...props} />;

  if (code === 51) return <CloudDrizzle {...props} color="#93c5fd" />;
  if (code === 53) return <CloudDrizzle {...props} color="#60a5fa" />;
  if (code === 55) return <CloudDrizzle {...props} color="#3b82f6" />;
  if (code === 56) return <CloudDrizzle {...props} color="#a78bfa" />;
  if (code === 57) return <CloudDrizzle {...props} color="#8b5cf6" />;

  if (code === 61) return isNight ? <CloudMoonRain {...props} color="#60a5fa" /> : <CloudSunRain {...props} color="#60a5fa" />;
  if (code === 63) return <CloudRain {...props} color="#2563eb" />;
  if (code === 65) return <CloudRainWind {...props} color="#1d4ed8" />;
  if (code === 66) return <CloudRain {...props} color="#a78bfa" />;
  if (code === 67) return <CloudRainWind {...props} color="#8b5cf6" />;

  if (code === 71) return <CloudSnow {...props} color="#7dd3fc" />;
  if (code === 73) return <CloudSnow {...props} color="#38bdf8" />;
  if (code === 75) return <CloudSnow {...props} color="#0284c7" />;
  if (code === 77) return <CloudSnow {...props} color="#0369a1" />;

  if (code === 80) return isNight ? <CloudMoonRain {...props} color="#60a5fa" /> : <CloudSunRain {...props} color="#60a5fa" />;
  if (code === 81) return <CloudRain {...props} color="#2563eb" />;
  if (code === 82) return <CloudRainWind {...props} color="#1e40af" />;
  if (code === 85) return <CloudSnow {...props} color="#38bdf8" />;
  if (code === 86) return <CloudSnow {...props} color="#0284c7" />;

  if (code === 95) return <CloudLightning {...props} color="#9333ea" />;
  if (code === 96) return <CloudHail {...props} color="#7c3aed" />;
  if (code === 99) return <CloudHail {...props} color="#6d28d9" />;

  return <HelpCircle {...props} />;
}

function getTopWeatherCodes(weatherCodeMembers, maxCount = 3) {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return [];
  const freq = {};
  for (const code of weatherCodeMembers) {
    freq[code] = (freq[code] || 0) + 1;
  }
  const total = weatherCodeMembers.length;
  return Object.entries(freq)
    .map(([code, count]) => ({ code: Number(code), probability: count / total }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, maxCount);
}

function computeMergedRuns(data) {
  const runs = [];
  let i = 0;
  while (i < data.length) {
    const code = data[i].weatherCode;
    const start = i;
    while (i < data.length && data[i].weatherCode === code) i++;
    runs.push({ code, start, length: i - start });
  }
  return runs;
}

function WeatherTooltip({ anchorRef, data, run, isNight, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const midIndex = run.start + Math.floor(run.length / 2);
  const topCodes = getTopWeatherCodes(data[midIndex].weatherCodeMembers);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  if (topCodes.length === 0 || !pos) return null;

  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      transform: 'translate(-50%, -100%)',
      marginTop: '-4px',
      background: 'rgba(40,40,40,0.95)',
      borderRadius: '6px',
      padding: '6px 8px',
      zIndex: 1000,
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    }}>
      {topCodes.map((entry) => (
        <div key={entry.code} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: 0.4 + 0.6 * entry.probability,
        }}>
          {getWeatherIcon(entry.code, isNight, 14)}
          <span style={{ fontSize: '10px', color: '#ddd' }}>
            {WEATHER_NAMES[entry.code] || `#${entry.code}`}
          </span>
          <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '2px' }}>
            {Math.round(entry.probability * 100)}%
          </span>
        </div>
      ))}
      {/* Arrow */}
      <div style={{
        position: 'absolute',
        bottom: '-4px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: '4px solid rgba(40,40,40,0.95)',
      }} />
    </div>
  );
}

export default function WeatherIconLane({ data }) {
  const [activeRun, setActiveRun] = useState(null);
  const handleClose = useCallback(() => setActiveRun(null), []);

  const runs = useMemo(() => computeMergedRuns(data), [data]);
  const overlayRefs = useMemo(() => runs.map(() => createRef()), [runs]);

  const cellInfo = useMemo(() => {
    const info = new Array(data.length);
    let colorIdx = 0;
    for (const run of runs) {
      for (let j = run.start; j < run.start + run.length; j++) {
        info[j] = {
          isStart: j === run.start,
          colorIdx,
        };
      }
      colorIdx++;
    }
    return info;
  }, [data, runs]);

  return (
    <div className="lane weather-icon-lane" style={{ height: '28px' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        {data.map((item, index) => {
          const ci = cellInfo[index];
          const bgColor = ci?.colorIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.04)';

          return (
            <div key={index} className="lane-cell" style={{
              backgroundColor: bgColor,
              borderLeft: ci?.isStart ? '1px solid rgba(0,0,0,0.08)' : 'none',
            }} />
          );
        })}

        {/* Overlay: render icons centered over each merged run */}
        {runs.map((run, runIdx) => {
          const midIndex = run.start + Math.floor(run.length / 2);
          const isNight = data[midIndex].sunAltitude < 0;
          const leftPx = `calc(${run.start} * var(--col-width-hour))`;
          const widthPx = `calc(${run.length} * var(--col-width-hour))`;
          const hasEnsemble = data[midIndex].weatherCodeMembers?.length > 0;

          return (
            <div key={`run-${runIdx}`}
              ref={overlayRefs[runIdx]}
              style={{
                position: 'absolute',
                left: leftPx,
                width: widthPx,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: hasEnsemble ? 'pointer' : 'default',
                zIndex: 1,
              }}
              onPointerEnter={() => hasEnsemble && setActiveRun(runIdx)}
              onPointerLeave={() => setActiveRun(null)}
              onClick={() => hasEnsemble && setActiveRun(activeRun === runIdx ? null : runIdx)}
            >
              {getWeatherIcon(run.code, isNight)}
              {activeRun === runIdx && (
                <WeatherTooltip
                  anchorRef={overlayRefs[runIdx]}
                  run={run}
                  data={data}
                  isNight={isNight}
                  onClose={handleClose}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
