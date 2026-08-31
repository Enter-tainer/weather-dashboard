import { useEffect, useState } from 'react';
import './Dashboard.css';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import type { WeatherPoint } from '../types/weather';
import { altitudeToTwilightColor, getTwilightPalette } from '../services/twilightColor';
import { useIsEink } from '../hooks/useRenderProfile';
import { useDashboardLayout } from '../hooks/useDashboardLayout';

interface TwilightLaneProps {
  data: WeatherPoint[];
  hourWidth?: number;
}

export default function TwilightLane({ data, hourWidth = DEFAULT_HOUR_WIDTH }: TwilightLaneProps) {
  const [, setThemeRevision] = useState(0);
  const isEink = useIsEink();
  const dashboardLayout = useDashboardLayout();
  const layout = useTimelineLayout(data.length, hourWidth);

  useEffect(() => {
    const handleThemeChange = () => setThemeRevision((revision) => revision + 1);
    window.addEventListener('weather-theme-change', handleThemeChange);
    return () => window.removeEventListener('weather-theme-change', handleThemeChange);
  }, []);

  if (!data || data.length === 0) return null;

  const palette = getTwilightPalette();
  // Build CSS gradient from sun altitude per hour, but with higher resolution
  // to ensure short twilight phases (like golden hour) aren't skipped
  // if they fall exactly between two hourly data points.
  const stops = [];
  const resolution = 4; // 4 stops per hour (every 15 mins)

  for (let i = 0; i < data.length - 1; i++) {
    const alt1 = data[i]?.sunAltitude ?? 10;
    const alt2 = data[i + 1]?.sunAltitude ?? 10;

    for (let s = 0; s < resolution; s++) {
      const t = s / resolution;
      const alt = alt1 + (alt2 - alt1) * t;
      const color = altitudeToTwilightColor(alt, palette);
      const pct = (layout.getTimePosition(i + t) / layout.totalWidth) * 100;
      stops.push(`${color} ${pct.toFixed(2)}%`);
    }
  }

  // Add the final hourly sample at its hour boundary, then hold its color to the end.
  if (data.length > 0) {
    const lastIdx = data.length - 1;
    const finalAlt = data[lastIdx]?.sunAltitude ?? 10;
    const finalColor = altitudeToTwilightColor(finalAlt, palette);
    const finalPct = (layout.getTimePosition(lastIdx) / layout.totalWidth) * 100;
    stops.push(`${finalColor} ${finalPct.toFixed(2)}%`);

    // Add end stops to stretch nicely to the very edges of the div
    const firstColor = altitudeToTwilightColor(data[0]?.sunAltitude ?? 10, palette);
    stops.unshift(`${firstColor} 0%`);
    stops.push(`${finalColor} 100%`);
  }

  const gradient = `linear-gradient(to right, ${stops.join(', ')})`;

  const totalWidth = layout.totalWidth;

  if (isEink) {
    const segments: Array<{ left: number; width: number; pattern: string }> = [];
    const resolution = 4;
    const patternForAltitude = (altitude: number): string =>
      altitude < 0 ? 'eink-pattern-dots-1' : 'eink-pattern-empty';

    for (let i = 0; i < data.length - 1; i++) {
      const alt1 = data[i]?.sunAltitude ?? 10;
      const alt2 = data[i + 1]?.sunAltitude ?? 10;
      for (let s = 0; s < resolution; s++) {
        const t = s / resolution;
        const left = layout.getTimePosition(i + t);
        const right = layout.getTimePosition(i + (s + 1) / resolution);
        segments.push({
          left,
          width: Math.max(0, right - left),
          pattern: patternForAltitude(alt1 + (alt2 - alt1) * t),
        });
      }
    }
    if (data.length > 0) {
      const lastLeft = layout.getTimePosition(data.length - 1);
      segments.push({
        left: lastLeft,
        width: Math.max(0, totalWidth - lastLeft),
        pattern: patternForAltitude(data[data.length - 1]?.sunAltitude ?? 10),
      });
    }

    const mergedSegments: Array<{ left: number; width: number; pattern: string }> = [];
    for (const segment of segments) {
      const previous = mergedSegments[mergedSegments.length - 1];
      if (
        previous &&
        previous.pattern === segment.pattern &&
        Math.abs(previous.left + previous.width - segment.left) < 0.01
      ) {
        previous.width += segment.width;
      } else {
        mergedSegments.push({ ...segment });
      }
    }

    return (
      <div
        className="lane twilight-lane"
        style={{
          height: `${dashboardLayout.twilightHeight}px`,
          minHeight: `${dashboardLayout.twilightHeight}px`,
        }}
      >
        <div
          className="lane-data"
          style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px` }}
        >
          {mergedSegments
            .filter((segment) => segment.pattern !== 'eink-pattern-empty')
            .map((segment, index) => (
              <div
                key={`eink-twilight-${index}`}
                className={segment.pattern}
                style={{
                  width: `${segment.width}px`,
                  height: '100%',
                  flexShrink: 0,
                  position: 'absolute',
                  left: `${segment.left}px`,
                }}
              />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="lane twilight-lane"
      style={{
        height: `${dashboardLayout.twilightHeight}px`,
        minHeight: `${dashboardLayout.twilightHeight}px`,
      }}
    >
      <div
        className="lane-data"
        style={{
          width: `${totalWidth}px`,
          minWidth: `${totalWidth}px`,
          background: gradient,
          borderTop: '1px solid var(--lane-border)',
          borderBottom: '1px solid var(--lane-border)',
        }}
      />
    </div>
  );
}
