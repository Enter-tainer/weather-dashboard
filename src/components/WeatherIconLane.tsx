import { useMemo, useState, useRef, useEffect, useCallback, createRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import './Dashboard.css';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudHail,
  CloudLightning,
  CloudSunRain,
  CloudMoonRain,
  HelpCircle,
} from 'lucide-react';
import type { WeatherPoint } from '../types/weather';
import { useTimelineLayout } from '../hooks/useTimelineLayout';

const WEATHER_NAMES: Record<number, string> = {
  0: '晴',
  1: '少云',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  56: '冻毛毛雨',
  57: '强冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '强冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '小阵雨',
  81: '中阵雨',
  82: '强阵雨',
  85: '小阵雪',
  86: '大阵雪',
  95: '雷暴',
  96: '雷暴+冰雹',
  99: '强雷暴+冰雹',
};

interface WeatherRun {
  code: number | null;
  start: number;
  length: number;
}

interface WeatherCodeProbability {
  code: number;
  probability: number;
}

interface WeatherIconLaneProps {
  data: WeatherPoint[];
}

interface WeatherTooltipProps {
  anchorRef: RefObject<HTMLDivElement | null>;
  data: WeatherPoint[];
  run: WeatherRun;
  isNight: boolean;
  onClose: () => void;
  forecastCode: number;
}

function getWeatherIcon(code: number, isNight: boolean, size = 18): ReactNode {
  const props = { size, color: 'var(--text-light)' };

  if (code === 0)
    return isNight ? <Moon {...props} color="#64748b" /> : <Sun {...props} color="#e69c00" />;
  if (code === 1)
    return isNight ? (
      <CloudMoon {...props} color="#64748b" />
    ) : (
      <CloudSun {...props} color="#deba37" />
    );
  if (code === 2)
    return <Cloud {...props} color={isNight ? 'var(--moonrise-color)' : 'var(--text-muted)'} />;
  if (code === 3)
    return <Cloud {...props} color={isNight ? 'var(--moonset-color)' : 'var(--text-light)'} />;
  if ([45, 48].includes(code)) return <CloudFog {...props} />;

  if (code === 51) return <CloudDrizzle {...props} color="rgb(var(--precip-drizzle-rgb))" />;
  if (code === 53) return <CloudDrizzle {...props} color="rgb(var(--precip-drizzle-rgb))" />;
  if (code === 55) return <CloudDrizzle {...props} color="rgb(var(--precip-rain-rgb))" />;
  if (code === 56) return <CloudDrizzle {...props} color="rgb(var(--precip-freezing-rgb))" />;
  if (code === 57) return <CloudDrizzle {...props} color="rgb(var(--precip-freezing-rgb))" />;

  if (code === 61)
    return isNight ? (
      <CloudMoonRain {...props} color="rgb(var(--precip-drizzle-rgb))" />
    ) : (
      <CloudSunRain {...props} color="rgb(var(--precip-drizzle-rgb))" />
    );
  if (code === 63) return <CloudRain {...props} color="rgb(var(--precip-rain-rgb))" />;
  if (code === 65) return <CloudRainWind {...props} color="rgb(var(--precip-rain-rgb))" />;
  if (code === 66) return <CloudRain {...props} color="rgb(var(--precip-freezing-rgb))" />;
  if (code === 67) return <CloudRainWind {...props} color="rgb(var(--precip-freezing-rgb))" />;

  if (code === 71) return <CloudSnow {...props} color="rgb(var(--precip-snow-rgb))" />;
  if (code === 73) return <CloudSnow {...props} color="rgb(var(--precip-snow-rgb))" />;
  if (code === 75) return <CloudSnow {...props} color="rgb(var(--precip-snow-rgb))" />;
  if (code === 77) return <CloudSnow {...props} color="rgb(var(--precip-snow-rgb))" />;

  if (code === 80)
    return isNight ? (
      <CloudMoonRain {...props} color="rgb(var(--precip-drizzle-rgb))" />
    ) : (
      <CloudSunRain {...props} color="rgb(var(--precip-drizzle-rgb))" />
    );
  if (code === 81) return <CloudRain {...props} color="rgb(var(--precip-rain-rgb))" />;
  if (code === 82) return <CloudRainWind {...props} color="rgb(var(--precip-rain-rgb))" />;
  if (code === 85) return <CloudSnow {...props} color="rgb(var(--precip-snow-rgb))" />;
  if (code === 86) return <CloudSnow {...props} color="rgb(var(--precip-snow-rgb))" />;

  if (code === 95) return <CloudLightning {...props} color="rgb(var(--precip-thunder-rgb))" />;
  if (code === 96) return <CloudHail {...props} color="rgb(var(--precip-thunder-rgb))" />;
  if (code === 99) return <CloudHail {...props} color="rgb(var(--precip-thunder-rgb))" />;

  return <HelpCircle {...props} />;
}

function getTopWeatherCodes(
  weatherCodeMembers: number[] | undefined,
  maxCount = 3,
): WeatherCodeProbability[] {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return [];
  const freq = new Map<number, number>();
  for (const code of weatherCodeMembers) {
    freq.set(code, (freq.get(code) ?? 0) + 1);
  }
  const total = weatherCodeMembers.length;
  return [...freq.entries()]
    .map(([code, count]) => ({ code, probability: count / total }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, maxCount);
}

function getDay(item: WeatherPoint): string {
  return item.time?.slice(0, 10) || '';
}

function computeMergedRuns(data: WeatherPoint[]): WeatherRun[] {
  const runs: WeatherRun[] = [];
  let i = 0;
  while (i < data.length) {
    const item = data[i];
    if (!item) break;
    const code = item.weatherCode;
    const day = getDay(item);
    const start = i;
    while (i < data.length) {
      const current = data[i];
      if (!current || current.weatherCode !== code || getDay(current) !== day) break;
      i++;
    }
    runs.push({ code, start, length: i - start });
  }
  return runs;
}

function WeatherTooltip({
  anchorRef,
  data,
  run,
  isNight,
  onClose,
  forecastCode,
}: WeatherTooltipProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const midIndex = run.start + Math.floor(run.length / 2);
  const midItem = data[midIndex];
  const topCodes = getTopWeatherCodes(midItem?.weatherCodeMembers);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  if (topCodes.length === 0 || !pos) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -100%)',
        marginTop: '-4px',
        background: 'var(--tooltip-bg)',
        borderRadius: '6px',
        padding: '6px 8px',
        zIndex: 1000,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.32)',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          borderBottom: '1px solid var(--tooltip-border)',
          paddingBottom: '3px',
          marginBottom: '1px',
        }}
      >
        {getWeatherIcon(forecastCode, isNight, 14)}
        <span style={{ fontSize: '10px', color: 'var(--tooltip-text)', fontWeight: 500 }}>
          {WEATHER_NAMES[forecastCode] || `#${forecastCode}`}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--tooltip-subtle)' }}>预报</span>
      </div>
      {topCodes.map((entry) => (
        <div
          key={entry.code}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: 0.4 + 0.6 * entry.probability,
          }}
        >
          {getWeatherIcon(entry.code, isNight, 14)}
          <span style={{ fontSize: '10px', color: 'var(--tooltip-muted)' }}>
            {WEATHER_NAMES[entry.code] || `#${entry.code}`}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--tooltip-subtle)', marginLeft: '2px' }}>
            {Math.round(entry.probability * 100)}%
          </span>
        </div>
      ))}
      {/* Arrow */}
      <div
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '4px solid var(--tooltip-bg)',
        }}
      />
    </div>,
    document.body,
  );
}

export default function WeatherIconLane({ data }: WeatherIconLaneProps) {
  const layout = useTimelineLayout(data.length);
  const [activeRun, setActiveRun] = useState<number | null>(null);
  const handleClose = useCallback(() => setActiveRun(null), []);

  const runs = useMemo(() => computeMergedRuns(data), [data]);
  const overlayRefs = useMemo(() => runs.map(() => createRef<HTMLDivElement>()), [runs]);

  const cellInfo = useMemo(() => {
    const info = new Array<{ isStart: boolean; colorIdx: number } | undefined>(data.length);
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
          const bgColor = ci && ci.colorIdx % 2 !== 0 ? 'var(--weather-stripe)' : 'transparent';

          return (
            <div
              key={index}
              className="lane-cell"
              style={{
                width: `${layout.getColumnWidth(index)}px`,
                backgroundColor: bgColor,
                borderLeft: ci?.isStart ? '1px solid var(--weather-run-border)' : 'none',
              }}
            />
          );
        })}

        {/* Overlay: render icons centered over each merged run */}
        {runs.map((run, runIdx) => {
          const overlayRef = overlayRefs[runIdx];
          if (!overlayRef) return null;
          if (run.code == null) return null;
          const midIndex = run.start + Math.floor(run.length / 2);
          const midItem = data[midIndex];
          if (!midItem) return null;
          const isNight = (midItem.sunAltitude ?? 10) < 0;
          const leftPx = `${layout.getColumnLeft(run.start)}px`;
          const widthPx = `${layout.getRangeWidth(run.start, run.start + run.length)}px`;
          const hasEnsemble = (midItem.weatherCodeMembers?.length ?? 0) > 0;

          return (
            <div
              key={`run-${runIdx}`}
              ref={overlayRef}
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
                  anchorRef={overlayRef}
                  run={run}
                  data={data}
                  isNight={isNight}
                  onClose={handleClose}
                  forecastCode={run.code}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
