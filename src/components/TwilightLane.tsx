import { useEffect, useState } from 'react';
import './Dashboard.css';
import { cssVar } from '../services/themeColors';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import type { WeatherPoint } from '../types/weather';

interface TwilightPalette {
  day: string;
  warmDay: string;
  golden: string;
  blue: string;
  nautical: string;
  night: string;
}

interface TwilightLaneProps {
  data: WeatherPoint[];
  hourWidth?: number;
}

// Map sun altitude (degrees) to a sky color
function getTwilightPalette(): TwilightPalette {
  return {
    day: cssVar('--twilight-day', '#ffffff'),
    warmDay: cssVar('--twilight-warm-day', '#ffe0b2'),
    golden: cssVar('--twilight-golden', '#ff9800'),
    blue: cssVar('--twilight-blue', '#3949ab'),
    nautical: cssVar('--twilight-nautical', '#1a237e'),
    night: cssVar('--twilight-night', '#0d0d1a'),
  };
}

function altitudeToColor(alt: number, palette: TwilightPalette): string {
  if (alt >= 10) return palette.day;
  if (alt >= 6) return lerpColor(palette.warmDay, palette.day, (alt - 6) / 4);
  if (alt >= -4) return lerpColor(palette.golden, palette.warmDay, (alt + 4) / 10);
  if (alt >= -6) return lerpColor(palette.blue, palette.golden, (alt + 6) / 2);
  if (alt >= -12) return lerpColor(palette.nautical, palette.blue, (alt + 12) / 6);
  if (alt >= -18) return lerpColor(palette.night, palette.nautical, (alt + 18) / 6);
  return palette.night;
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (color: string): [number, number, number] => [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

export default function TwilightLane({ data, hourWidth = DEFAULT_HOUR_WIDTH }: TwilightLaneProps) {
  const [, setThemeRevision] = useState(0);
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
      const color = altitudeToColor(alt, palette);
      const pct = (layout.getTimePosition(i + t) / layout.totalWidth) * 100;
      stops.push(`${color} ${pct.toFixed(2)}%`);
    }
  }

  // Add the final hourly sample at its hour boundary, then hold its color to the end.
  if (data.length > 0) {
    const lastIdx = data.length - 1;
    const finalAlt = data[lastIdx]?.sunAltitude ?? 10;
    const finalColor = altitudeToColor(finalAlt, palette);
    const finalPct = (layout.getTimePosition(lastIdx) / layout.totalWidth) * 100;
    stops.push(`${finalColor} ${finalPct.toFixed(2)}%`);

    // Add end stops to stretch nicely to the very edges of the div
    const firstColor = altitudeToColor(data[0]?.sunAltitude ?? 10, palette);
    stops.unshift(`${firstColor} 0%`);
    stops.push(`${finalColor} 100%`);
  }

  const gradient = `linear-gradient(to right, ${stops.join(', ')})`;

  const totalWidth = layout.totalWidth;

  return (
    <div className="lane" style={{ height: '12px', minHeight: '12px' }}>
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
