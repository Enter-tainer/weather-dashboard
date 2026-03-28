import { useMemo } from 'react';

const COL_WIDTH = 22;

// Soft ambient colors for weather categories
// RGB values chosen to blend well together as subtle backgrounds
const WEATHER_COLORS = {
  clear:   [255, 213, 79],   // warm golden
  cloudy:  [176, 180, 188],  // cool gray
  fog:     [176, 192, 186],  // gray-green
  drizzle: [147, 197, 253],  // light blue
  rain:    [96, 165, 250],   // medium blue
  snow:    [186, 230, 253],  // ice blue
  thunder: [192, 132, 252],  // purple
};

function getWeatherCategory(code) {
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

function computeBlendedColor(weatherCodeMembers) {
  if (!weatherCodeMembers || weatherCodeMembers.length === 0) return null;

  // Group by category and sum probabilities
  const catFreq = {};
  for (const code of weatherCodeMembers) {
    const cat = getWeatherCategory(code);
    catFreq[cat] = (catFreq[cat] || 0) + 1;
  }
  const total = weatherCodeMembers.length;

  // Weighted average of all category colors
  let r = 0, g = 0, b = 0;
  for (const [cat, count] of Object.entries(catFreq)) {
    const prob = count / total;
    const color = WEATHER_COLORS[cat];
    r += color[0] * prob;
    g += color[1] * prob;
    b += color[2] * prob;
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
}

// Top offset: LocationLane(24) + TimeAxis(50) + TwilightLane(12) = 86px
// Height: WeatherIcon(28) + UV(25) + Humidity(35) + TempText(35) + TempCurve(110) = 233px
const BG_TOP = 'calc(24px + var(--lane-height-basic) + 12px)';
const BG_HEIGHT = 'calc(28px + var(--lane-height-uv) + var(--lane-height-humidity) + 35px + var(--lane-height-temp))';

const ALPHA = 0.18;

export default function WeatherAmbientBackground({ data }) {
  // Compute one blended color per hour, then build a single wide linear-gradient
  const gradient = useMemo(() => {
    const colors = data.map(item => computeBlendedColor(item.weatherCodeMembers));

    // Build gradient stops: one color stop at the center of each column
    const stops = [];
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      if (!c) continue;
      const centerPx = (i + 0.5) * COL_WIDTH;
      stops.push(`rgba(${c[0]},${c[1]},${c[2]},${ALPHA}) ${centerPx}px`);
    }

    if (stops.length === 0) return 'transparent';
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [data]);

  const totalWidth = data.length * COL_WIDTH;

  return (
    <div style={{
      position: 'absolute',
      top: BG_TOP,
      left: 0,
      width: totalWidth,
      height: BG_HEIGHT,
      zIndex: 0,
      pointerEvents: 'none',
      background: gradient,
    }} />
  );
}
