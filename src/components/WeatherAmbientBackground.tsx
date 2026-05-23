import { useCanvas } from '../hooks/useCanvas';
import type { WeatherPoint } from '../types/weather';

const COL_WIDTH = 22;

type WeatherCategory = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';
type RgbTuple = readonly [r: number, g: number, b: number];

interface WeatherDistributionSegment {
  cat: WeatherCategory;
  prob: number;
}

interface WeatherAmbientBackgroundProps {
  data: WeatherPoint[];
  compact?: boolean;
}

// Soft ambient colors for weather categories
const WEATHER_COLORS = {
  clear:   [255, 213, 79],
  cloudy:  [190, 194, 200],
  fog:     [182, 198, 192],
  drizzle: [147, 197, 253],
  rain:    [96, 165, 250],
  snow:    [186, 230, 253],
  thunder: [192, 132, 252],
} as const satisfies Record<WeatherCategory, RgbTuple>;

const CATEGORY_ORDER = ['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder'] as const satisfies readonly WeatherCategory[];

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

function computeDistribution(weatherCodeMembers: number[] | undefined): WeatherDistributionSegment[] | null {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return null;

  const catFreq: Partial<Record<WeatherCategory, number>> = {};
  for (const code of weatherCodeMembers) {
    const cat = getWeatherCategory(code);
    catFreq[cat] = (catFreq[cat] ?? 0) + 1;
  }
  const total = weatherCodeMembers.length;

  return CATEGORY_ORDER
    .filter(cat => catFreq[cat] != null)
    .map(cat => ({ cat, prob: (catFreq[cat] ?? 0) / total }));
}

const ALPHA = 0.22;
const H_RADIUS_PX = COL_WIDTH * 1.2;
const WEATHER_ICON_LANE_HEIGHT = 28;
const UV_LANE_HEIGHT = 25;
const THERMO_HYGRO_LANE_HEIGHT = 80;
const COMPACT_TEMP_LANE_HEIGHT = 35;

// From below the twilight strip through weather icon, UV, and temperature/humidity.
const FULL_BG_HEIGHT = WEATHER_ICON_LANE_HEIGHT + UV_LANE_HEIGHT + THERMO_HYGRO_LANE_HEIGHT;
const COMPACT_BG_HEIGHT = WEATHER_ICON_LANE_HEIGHT + UV_LANE_HEIGHT + COMPACT_TEMP_LANE_HEIGHT;

export default function WeatherAmbientBackground({ data, compact = false }: WeatherAmbientBackgroundProps) {
  const totalWidth = data.length * COL_WIDTH;
  const bgHeight = compact ? COMPACT_BG_HEIGHT : FULL_BG_HEIGHT;

  const canvasRef = useCanvas(totalWidth, bgHeight, (ctx) => {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item) continue;
      const dist = computeDistribution(item.weatherCodeMembers);
      if (!dist) continue;

      const cx = (i + 0.5) * COL_WIDTH;

      let cumulative = 0;
      for (const seg of dist) {
        const yCenter = (cumulative + seg.prob / 2) * bgHeight;
        const vRadius = Math.max(seg.prob * bgHeight * 0.7, 8);
        const [r, g, b] = WEATHER_COLORS[seg.cat];

        // Draw elliptical gradient matching CSS radial-gradient(Hpx Vpx at cx cy)
        // Scale context so a circular gradient becomes elliptical
        ctx.save();
        ctx.translate(cx, yCenter);
        ctx.scale(H_RADIUS_PX / vRadius, 1);

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
  }, [data]);

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(24px + var(--lane-height-basic) + 12px)',
      left: 0,
      width: totalWidth,
      height: `${bgHeight}px`,
      zIndex: 0,
      pointerEvents: 'none',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
