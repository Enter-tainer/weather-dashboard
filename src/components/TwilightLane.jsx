import './Dashboard.css';

const COL_WIDTH = 22;

// Map sun altitude (degrees) to a sky color
function altitudeToColor(alt) {
  if (alt >= 6) return '#ffffff';                    // day
  if (alt >= 0) return lerpColor('#ffb74d', '#ffffff', alt / 6);   // golden hour (0°→6°)
  if (alt >= -6) return lerpColor('#5c6bc0', '#ffb74d', (alt + 6) / 6);  // blue hour (-6°→0°)
  if (alt >= -12) return lerpColor('#1a237e', '#5c6bc0', (alt + 12) / 6); // nautical (-12°→-6°)
  if (alt >= -18) return lerpColor('#0d0d1a', '#1a237e', (alt + 18) / 6); // astronomical (-18°→-12°)
  return '#0d0d1a';                                  // night
}

function lerpColor(a, b, t) {
  const parse = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

export default function TwilightLane({ data }) {
  if (!data || data.length === 0) return null;

  // Build CSS gradient from sun altitude per hour, but with higher resolution
  // to ensure short twilight phases (like golden hour) aren't skipped
  // if they fall exactly between two hourly data points.
  const stops = [];
  const resolution = 4; // 4 stops per hour (every 15 mins)

  for (let i = 0; i < data.length - 1; i++) {
    const alt1 = data[i].sunAltitude ?? 10;
    const alt2 = data[i+1].sunAltitude ?? 10;
    
    for (let s = 0; s < resolution; s++) {
      const t = s / resolution;
      const alt = alt1 + (alt2 - alt1) * t;
      const color = altitudeToColor(alt);
      const pct = ((i + 0.5 + t) / data.length) * 100;
      stops.push(`${color} ${pct.toFixed(2)}%`);
    }
  }

  // Add the final data point's center
  if (data.length > 0) {
    const lastIdx = data.length - 1;
    const finalAlt = data[lastIdx].sunAltitude ?? 10;
    const finalColor = altitudeToColor(finalAlt);
    const finalPct = ((lastIdx + 0.5) / data.length) * 100;
    stops.push(`${finalColor} ${finalPct.toFixed(2)}%`);
    
    // Add end stops to stretch nicely to the very edges of the div
    const firstColor = altitudeToColor(data[0].sunAltitude ?? 10);
    stops.unshift(`${firstColor} 0%`);
    stops.push(`${finalColor} 100%`);
  }

  const gradient = `linear-gradient(to right, ${stops.join(', ')})`;

  const totalWidth = data.length * COL_WIDTH;

  return (
    <div className="lane" style={{ height: '12px', minHeight: '12px' }}>
      <div className="lane-data" style={{
        width: `${totalWidth}px`,
        minWidth: `${totalWidth}px`,
        background: gradient,
        borderTop: '1px solid rgba(0,0,0,0.08)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }} />
    </div>
  );
}
