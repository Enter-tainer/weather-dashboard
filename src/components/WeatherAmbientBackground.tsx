import { useCanvas } from '../hooks/useCanvas';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import type { WeatherPoint } from '../types/weather';
import { useDashboardLayout } from '../hooks/useDashboardLayout';

type WeatherCategory = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';
type RgbTuple = readonly [r: number, g: number, b: number];

interface WeatherDistributionSegment {
  cat: WeatherCategory;
  prob: number;
}

interface WeatherAmbientBackgroundProps {
  data: WeatherPoint[];
  compact?: boolean;
  hourWidth?: number;
}

// Soft ambient colors for weather categories
const WEATHER_COLORS = {
  clear: [255, 213, 79],
  cloudy: [190, 194, 200],
  fog: [182, 198, 192],
  drizzle: [147, 197, 253],
  rain: [96, 165, 250],
  snow: [186, 230, 253],
  thunder: [192, 132, 252],
} as const satisfies Record<WeatherCategory, RgbTuple>;

const CATEGORY_ORDER = [
  'clear',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'thunder',
] as const satisfies readonly WeatherCategory[];

function getWeatherCategory(code: number): WeatherCategory {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'thunder';
}

function computeDistribution(
  weatherCodeMembers: number[] | undefined,
): WeatherDistributionSegment[] | null {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return null;

  const catFreq: Partial<Record<WeatherCategory, number>> = {};
  for (const code of weatherCodeMembers) {
    const cat = getWeatherCategory(code);
    catFreq[cat] = (catFreq[cat] ?? 0) + 1;
  }
  const total = weatherCodeMembers.length;

  return CATEGORY_ORDER.filter((cat) => catFreq[cat] != null).map((cat) => ({
    cat,
    prob: (catFreq[cat] ?? 0) / total,
  }));
}

const ALPHA = 0.22;
const COMPACT_TEMP_LANE_HEIGHT = 35;

export default function WeatherAmbientBackground({
  data,
  compact = false,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: WeatherAmbientBackgroundProps) {
  const dashboardLayout = useDashboardLayout();
  const layout = useTimelineLayout(data.length, hourWidth);
  const totalWidth = layout.totalWidth;
  const bgHeight =
    dashboardLayout.weatherIconHeight +
    dashboardLayout.uvHeight +
    (compact ? COMPACT_TEMP_LANE_HEIGHT : dashboardLayout.thermalHeight);

  const canvasRef = useCanvas(
    totalWidth,
    bgHeight,
    (ctx) => {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item) continue;
        const dist = computeDistribution(item.weatherCodeMembers);
        if (!dist) continue;

        const cx = layout.getColumnCenter(i);
        const hRadiusPx = Math.max(hourWidth * 1.2, layout.getColumnWidth(i) * 0.8);

        let cumulative = 0;
        for (const seg of dist) {
          const yCenter = (cumulative + seg.prob / 2) * bgHeight;
          const vRadius = Math.max(seg.prob * bgHeight * 0.7, 8);
          const [r, g, b] = WEATHER_COLORS[seg.cat];

          // Draw elliptical gradient matching CSS radial-gradient(Hpx Vpx at cx cy)
          // Scale context so a circular gradient becomes elliptical
          ctx.save();
          ctx.translate(cx, yCenter);
          ctx.scale(hRadiusPx / vRadius, 1);

          // Create gradient in scaled space (circular, radius = vRadius)
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, vRadius);
          grad.addColorStop(0, `rgba(${r},${g},${b},${ALPHA})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = grad;

          ctx.beginPath();
          ctx.arc(0, 0, vRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          cumulative += seg.prob;
        }
      }
    },
    [data, layout, hourWidth, bgHeight],
  );

  return (
    <div
      className="weather-ambient-background"
      style={{
        position: 'absolute',
        top: 'calc(var(--lane-height-location) + var(--lane-height-basic) + var(--lane-height-twilight))',
        left: 0,
        width: totalWidth,
        height: `${bgHeight}px`,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
