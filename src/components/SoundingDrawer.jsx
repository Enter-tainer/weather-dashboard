import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { APPROX_PRESSURE_HEIGHTS, detectInversions, withSurfaceLevel } from '../services/sounding';

const PRESSURE_MAJOR = [1000, 925, 850, 700, 600, 500, 400, 300];
const PRESSURE_MINOR = [975, 950, 900, 800];
const TEMP_LINES = [-70, -60, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40];
const DRY_ADIABATS = [260, 280, 300, 320, 340, 360, 380, 400, 420];
const MIXING_LINES = [1, 2, 4, 8, 12, 16];

const CHART = {
  width: 480,
  height: 540,
  left: 48,
  right: 344,
  top: 28,
  bottom: 468,
  windX: 404,
  pTop: 300,
  pBottom: 1050,
  tempMin: -70,
  tempMax: 42,
  skew: 88,
};

function formatTime(item) {
  const date = new Date(item.time);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, '0');
  return `${month}/${day} ${hour}:00`;
}

function round(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

function formatHeight(value) {
  if (value == null || !Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  return `${Math.round(value)} m`;
}

function dewPointFromVaporPressure(e) {
  const ratio = Math.log(e / 6.112);
  return (243.5 * ratio) / (17.67 - ratio);
}

function makePolylinePath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function SkewTChart({ item }) {
  const { levels, inversions } = useMemo(() => {
    const allLevels = withSurfaceLevel(item)
      .filter(level => level.pressure && level.temp != null)
      .sort((a, b) => b.pressure - a.pressure);
    return {
      levels: allLevels,
      inversions: detectInversions(item),
    };
  }, [item]);

  const plotW = CHART.right - CHART.left;
  const plotH = CHART.bottom - CHART.top;
  const logTop = Math.log(CHART.pTop);
  const logBottom = Math.log(CHART.pBottom);

  const yForPressure = (pressure) => {
    const yNorm = (Math.log(pressure) - logTop) / (logBottom - logTop);
    return CHART.top + yNorm * plotH;
  };

  const xFor = (temp, pressure) => {
    const yNorm = (Math.log(pressure) - logTop) / (logBottom - logTop);
    const tempX = ((temp - CHART.tempMin) / (CHART.tempMax - CHART.tempMin)) * plotW;
    return CHART.left + tempX + CHART.skew * (1 - yNorm);
  };

  const heightLevels = levels
    .map(level => ({
      agl: level.agl ?? APPROX_PRESSURE_HEIGHTS[level.pressure] ?? null,
      pressure: level.pressure,
    }))
    .filter(level => level.agl != null)
    .sort((a, b) => a.agl - b.agl);

  const yForHeight = (heightM) => {
    if (!heightLevels.length) return null;
    if (heightM <= heightLevels[0].agl) return yForPressure(heightLevels[0].pressure);
    for (let i = 0; i < heightLevels.length - 1; i++) {
      const lower = heightLevels[i];
      const upper = heightLevels[i + 1];
      if (heightM <= upper.agl) {
        const ratio = (heightM - lower.agl) / (upper.agl - lower.agl);
        return yForPressure(lower.pressure) + ratio * (yForPressure(upper.pressure) - yForPressure(lower.pressure));
      }
    }
    return yForPressure(heightLevels[heightLevels.length - 1].pressure);
  };

  const heightForPressure = (pressure) => {
    const exact = heightLevels.find(level => level.pressure === pressure);
    return exact?.agl ?? APPROX_PRESSURE_HEIGHTS[pressure] ?? null;
  };

  const pathFor = (key) => makePolylinePath(
    levels
      .filter(level => level[key] != null)
      .map(level => ({ x: xFor(level[key], level.pressure), y: yForPressure(level.pressure) }))
  );

  const dryAdiabatPath = (thetaK) => {
    const points = [];
    for (let pressure = 1050; pressure >= 300; pressure -= 25) {
      const temp = thetaK * Math.pow(pressure / 1000, 0.286) - 273.15;
      points.push({ x: xFor(temp, pressure), y: yForPressure(pressure) });
    }
    return makePolylinePath(points);
  };

  const mixingRatioPath = (gramsPerKg) => {
    const points = [];
    const w = gramsPerKg / 1000;
    for (let pressure = 1000; pressure >= 450; pressure -= 25) {
      const e = (w * pressure) / (0.622 + w);
      points.push({ x: xFor(dewPointFromVaporPressure(e), pressure), y: yForPressure(pressure) });
    }
    return makePolylinePath(points);
  };

  const windBarbPath = (speedKmh) => {
    const knots = Math.max(0, speedKmh / 1.852);
    let remaining = Math.round(knots / 5) * 5;
    let x = 22;
    const parts = ['M0 0 L28 0'];

    while (remaining >= 50) {
      parts.push(`M${x} 0 L${x - 7} -8 L${x - 2} 0 Z`);
      x -= 5;
      remaining -= 50;
    }
    while (remaining >= 10) {
      parts.push(`M${x} 0 L${x - 7} -8`);
      x -= 4;
      remaining -= 10;
    }
    if (remaining >= 5) {
      parts.push(`M${x} 0 L${x - 4} -5`);
    }

    return parts.join(' ');
  };

  if (levels.length < 3) {
    return (
      <div className="sounding-empty">
        当前小时没有可用的压力层温度/湿度数据。
      </div>
    );
  }

  return (
    <div className="sounding-chart-shell">
      <svg className="sounding-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="Skew-T">
        <defs>
          <clipPath id="sounding-plot-clip">
            <rect x={CHART.left} y={CHART.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        <rect x={CHART.left} y={CHART.top} width={plotW} height={plotH} fill="#fbfbf8" />

        <g clipPath="url(#sounding-plot-clip)">
          {inversions.map((inv, index) => {
            const yTop = yForHeight(inv.topM);
            const yBottom = yForHeight(inv.baseM);
            if (yTop == null || yBottom == null) return null;
            return (
              <rect
                key={`inv-${index}`}
                x={CHART.left}
                y={Math.min(yTop, yBottom)}
                width={plotW}
                height={Math.abs(yBottom - yTop)}
                fill="rgba(214, 106, 0, 0.14)"
              />
            );
          })}

          {PRESSURE_MINOR.map(p => (
            <line key={`p-minor-${p}`} x1={CHART.left} x2={CHART.right} y1={yForPressure(p)} y2={yForPressure(p)} stroke="rgba(0,0,0,0.06)" />
          ))}

          {TEMP_LINES.map(t => (
            <line
              key={`t-${t}`}
              x1={xFor(t, CHART.pBottom)}
              y1={yForPressure(CHART.pBottom)}
              x2={xFor(t, CHART.pTop)}
              y2={yForPressure(CHART.pTop)}
              stroke={t === 0 ? 'rgba(190, 45, 45, 0.46)' : 'rgba(115, 84, 66, 0.13)'}
              strokeWidth={t === 0 ? 1.2 : 0.8}
            />
          ))}

          {DRY_ADIABATS.map(theta => (
            <path key={`dry-${theta}`} d={dryAdiabatPath(theta)} fill="none" stroke="rgba(167, 111, 36, 0.16)" strokeWidth="0.8" />
          ))}

          {MIXING_LINES.map(value => (
            <path key={`mix-${value}`} d={mixingRatioPath(value)} fill="none" stroke="rgba(31, 128, 94, 0.16)" strokeWidth="0.8" strokeDasharray="4 4" />
          ))}

          <path d={pathFor('dewPoint')} fill="none" stroke="#16845f" strokeWidth="2.2" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathFor('temp')} fill="none" stroke="#c92f2f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {PRESSURE_MAJOR.map(p => {
          const y = yForPressure(p);
          return (
            <g key={`p-${p}`}>
              <line x1={CHART.left} x2={CHART.right} y1={y} y2={y} stroke="rgba(0,0,0,0.16)" />
              <text x={CHART.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#555">{p}</text>
              <text x={CHART.right + 8} y={y + 3} fontSize="9" fill="#8a8a8a">{formatHeight(heightForPressure(p))}</text>
            </g>
          );
        })}

        {TEMP_LINES.filter(t => t % 20 === 0).map(t => (
          <text key={`temp-label-${t}`} x={xFor(t, CHART.pBottom)} y={CHART.bottom + 18} textAnchor="middle" fontSize="10" fill="#666">{t}</text>
        ))}

        {MIXING_LINES.map(value => (
          <text
            key={`mix-label-${value}`}
            x={xFor(dewPointFromVaporPressure(((value / 1000) * 500) / (0.622 + value / 1000)), 500) + 3}
            y={yForPressure(500) - 3}
            fontSize="8"
            fill="rgba(31, 128, 94, 0.62)"
          >
            {value}
          </text>
        ))}

        {levels
          .filter(level => level.windSpeed != null && level.windDir != null)
          .filter(level => PRESSURE_MAJOR.includes(Math.round(level.pressure)))
          .map(level => {
            const y = yForPressure(level.pressure);
            return (
              <g
                key={`wind-${level.pressure}`}
                transform={`translate(${CHART.windX} ${y}) rotate(${level.windDir + 180})`}
                stroke="#444"
                strokeWidth="1.25"
                fill="rgba(68, 68, 68, 0.16)"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={windBarbPath(level.windSpeed)} />
              </g>
            );
          })}

        <rect x={CHART.left} y={CHART.top} width={plotW} height={plotH} fill="none" stroke="rgba(0,0,0,0.22)" />
        <line x1={CHART.windX - 14} x2={CHART.windX - 14} y1={CHART.top} y2={CHART.bottom} stroke="rgba(0,0,0,0.08)" />

        <text x={CHART.left} y={CHART.height - 14} fontSize="10" fill="#666">Temperature (°C)</text>
        <text x={CHART.left - 36} y={CHART.top - 10} fontSize="10" fill="#666">hPa</text>
        <text x={CHART.right + 8} y={CHART.top - 10} fontSize="10" fill="#777">AGL</text>
        <text x={CHART.windX - 10} y={CHART.top - 10} fontSize="10" fill="#777">Wind</text>
        <text x={CHART.left + 168} y={CHART.top + 16} fontSize="9" fill="rgba(167, 111, 36, 0.6)">dry adiabats</text>
        <text x={CHART.left + 218} y={CHART.top + 32} fontSize="9" fill="rgba(31, 128, 94, 0.62)">mixing ratio g/kg</text>
      </svg>

      <div className="sounding-legend">
        <span><i className="sounding-swatch temp" />T</span>
        <span><i className="sounding-swatch dew" />Td</span>
        <span><i className="sounding-swatch inversion" />逆温</span>
      </div>
    </div>
  );
}

export default function SoundingDrawer({ item, index, total, onClose, onStep }) {
  const inversions = useMemo(() => detectInversions(item), [item]);
  const spread = item.temperature != null && item.dewPoint != null ? item.temperature - item.dewPoint : null;

  return (
    <aside className="sounding-drawer" aria-label="Skew-T 探空图">
      <div className="sounding-header">
        <div>
          <div className="sounding-kicker">Sounding profile</div>
          <div className="sounding-title">Skew-T Log-P</div>
          <div className="sounding-subtitle">{item.cityName} · {formatTime(item)}</div>
        </div>
        <button type="button" className="sounding-icon-btn" onClick={onClose} aria-label="关闭 Skew-T">
          <X size={18} />
        </button>
      </div>

      <div className="sounding-nav" aria-label="切换探空时次">
        <button type="button" className="sounding-step-btn" onClick={() => onStep(-1)} disabled={index <= 0} aria-label="上一小时">
          <ChevronLeft size={18} />
        </button>
        <span>{index + 1} / {total}</span>
        <button type="button" className="sounding-step-btn" onClick={() => onStep(1)} disabled={index >= total - 1} aria-label="下一小时">
          <ChevronRight size={18} />
        </button>
      </div>

      <SkewTChart item={item} />

      <div className="sounding-summary">
        <div>
          <span>T / Td</span>
          <strong>{round(item.temperature, 1)} / {round(item.dewPoint, 1)}°C</strong>
        </div>
        <div>
          <span>Spread</span>
          <strong>{round(spread, 1)}°C</strong>
        </div>
        <div>
          <span>Wind</span>
          <strong>{round(item.windSpeed)} km/h · {round(item.windDir)}°</strong>
        </div>
        <div>
          <span>Inversion</span>
          <strong>{inversions.length ? `${formatHeight(inversions[0].baseM)}-${formatHeight(inversions[0].topM)}` : 'none'}</strong>
        </div>
      </div>

      {inversions.length > 0 && (
        <div className="sounding-inversions">
          {inversions.map((inv, i) => (
            <div key={i}>
              逆温层 {formatHeight(inv.baseM)}-{formatHeight(inv.topM)}，
              强度 {round(inv.strengthC, 1)}°C，
              梯度 {round(inv.gradientCPer100m, 2)}°C/100m
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
