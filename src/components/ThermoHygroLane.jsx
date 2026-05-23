import { useMemo, useState, useRef, useEffect, useCallback, createRef } from 'react';
import { createPortal } from 'react-dom';
import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';

const COL_WIDTH = 22;
const LANE_HEIGHT = 80;
const TOP_LABEL_H = 13;
const BOT_LABEL_H = 12;
const BAR_TOP = TOP_LABEL_H;
const BAR_BOT = LANE_HEIGHT - BOT_LABEL_H;
const BAR_H_MAX = BAR_BOT - BAR_TOP;
const BAR_W = 12;
const BAR_X = (COL_WIDTH - BAR_W) / 2;

// ── Temperature color stops ──
const COLOR_STOPS = [
  [-20, 20, 30, 180],
  [0, 40, 120, 220],
  [15, 80, 180, 160],
  [25, 250, 180, 60],
  [40, 200, 50, 20],
];

function lerp(a, b, t) { return a + (b - a) * t; }

function tempColor(temp) {
  const t = Math.max(COLOR_STOPS[0][0], Math.min(COLOR_STOPS[COLOR_STOPS.length - 1][0], temp));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, r0, g0, b0] = COLOR_STOPS[i];
    const [t1, r1, g1, b1] = COLOR_STOPS[i + 1];
    if (t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(lerp(r0, r1, ratio))},${Math.round(lerp(g0, g1, ratio))},${Math.round(lerp(b0, b1, ratio))})`;
    }
  }
  const [, r, g, b] = COLOR_STOPS[COLOR_STOPS.length - 1];
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// ── Ensemble helpers ──
function percentile(sorted, p) {
  if (!sorted || sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const k = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (k - lo) * (sorted[hi] - sorted[lo]);
}

function computeEnsemble(members) {
  if (!members || members.length === 0) return null;
  const sorted = [...members].sort((a, b) => a - b);
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

function getEnsemble(d) {
  if (d.tempEnsemble) return d.tempEnsemble;
  return computeEnsemble(d.tempMembers);
}

// ── Wind direction to Chinese label ──
const WIND_DIRS = ['北', '北东北', '东北', '东东北', '东', '东东南', '东南', '南东南', '南', '南西南', '西南', '西西南', '西', '西西北', '西北', '北西北'];

function windDirLabel(deg) {
  if (deg == null) return '—';
  const idx = Math.round(deg / 22.5) % 16;
  return WIND_DIRS[idx];
}

// ── Tooltip component ──
function ThermoTooltip({ anchorRef, d, ens, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      // Position above the lane, but fall back to below if not enough room
      const tooltipH = 150; // approximate max height
      const aboveY = rect.top - 4 - tooltipH;
      const showBelow = aboveY < 4;
      setPos({
        x: rect.left + rect.width / 2,
        y: showBelow ? rect.bottom + 4 : rect.top - 4,
        showBelow,
      });
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

  if (!pos) return null;

  const timeStr = d.time ? new Date(d.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const feelsDiff = d.apparentTemp - d.temperature;
  const feelsColor = Math.abs(feelsDiff) >= 2 ? (feelsDiff > 0 ? 'var(--sunrise-color)' : 'var(--precip-prob-40)') : 'var(--tooltip-subtle)';

  const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '10px' };
  const labelStyle = { color: 'var(--tooltip-subtle)' };
  const valStyle = { color: 'var(--tooltip-text)', fontWeight: 500 };
  const dimValStyle = { color: 'var(--tooltip-muted)', fontWeight: 400 };

  return createPortal(
    <div ref={ref} style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      transform: pos.showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
      background: 'var(--tooltip-bg)',
      borderRadius: '6px',
      padding: '6px 8px',
      zIndex: 1000,
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0,0,0,0.32)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: '140px',
    }}>
      {/* Time header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        borderBottom: '1px solid var(--tooltip-border)',
        paddingBottom: '3px', marginBottom: '1px',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--tooltip-muted)', fontWeight: 500 }}>{timeStr}</span>
        {d.cityName && <span style={{ fontSize: '9px', color: 'var(--tooltip-subtle)' }}>{d.cityName}</span>}
      </div>

      {/* Temperature */}
      <div style={rowStyle}>
        <span style={labelStyle}>温度</span>
        <span style={valStyle}>{Math.round(d.temperature)}°</span>
      </div>

      {/* Feels like */}
      <div style={rowStyle}>
        <span style={labelStyle}>体感</span>
        <span style={{ ...valStyle, color: feelsColor }}>
          {Math.round(d.apparentTemp)}°
          {Math.abs(feelsDiff) >= 0.8 && (
            <span style={{ fontSize: '8px', marginLeft: '2px' }}>
              {feelsDiff > 0 ? '↑' : '↓'}{Math.abs(feelsDiff).toFixed(1)}
            </span>
          )}
        </span>
      </div>

      {/* Dew point */}
      <div style={rowStyle}>
        <span style={labelStyle}>露点</span>
        <span style={dimValStyle}>{Math.round(d.dewPoint)}°</span>
      </div>

      {/* Humidity */}
      <div style={rowStyle}>
        <span style={labelStyle}>湿度</span>
        <span style={dimValStyle}>{Math.round(d.humidity)}%</span>
      </div>

      {/* Wind */}
      <div style={rowStyle}>
        <span style={labelStyle}>风速</span>
        <span style={dimValStyle}>
          {d.windSpeed != null ? `${d.windSpeed.toFixed(1)} km/h` : '—'}
          {d.windDir != null ? ` ${windDirLabel(d.windDir)}` : ''}
        </span>
      </div>

      {/* Pressure */}
      <div style={rowStyle}>
        <span style={labelStyle}>气压</span>
        <span style={dimValStyle}>{d.pressure != null ? `${Math.round(d.pressure)} hPa` : '—'}</span>
      </div>

      {/* Ensemble range */}
      {ens && ens.p10 != null && ens.p90 != null && ens.p10 !== ens.p90 && (
        <div style={{
          ...rowStyle,
          borderTop: '1px solid var(--tooltip-border)',
          paddingTop: '2px', marginTop: '1px',
        }}>
          <span style={labelStyle}>集合</span>
          <span style={{ ...dimValStyle, fontSize: '9px' }}>
            {ens.p10.toFixed(1)}° ~ {ens.p90.toFixed(1)}°
          </span>
        </div>
      )}

      {/* Arrow */}
      <div style={{
        position: 'absolute',
        ...(pos.showBelow
          ? { top: '-4px', borderBottom: '4px solid var(--tooltip-bg)', borderTop: 'none' }
          : { bottom: '-4px', borderTop: '4px solid var(--tooltip-bg)', borderBottom: 'none' }),
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
      }} />
    </div>,
    document.body
  );
}

export default function ThermoHygroLane({ data, minTemp, maxTemp }) {
  const totalWidth = data.length * COL_WIDTH;
  const ensembles = useMemo(() => data.map(d => getEnsemble(d)), [data]);

  const [activeIndex, setActiveIndex] = useState(null);
  const handleClose = useCallback(() => setActiveIndex(null), []);
  const cellRefs = useMemo(() => data.map(() => createRef()), [data]);

  const tRange = maxTemp - minTemp || 1;
  const tempToY = (t) => BAR_BOT - ((t - minTemp) / tRange) * BAR_H_MAX;

  const canvasRef = useCanvas(totalWidth, LANE_HEIGHT, (ctx) => {
    const cellHover = cssVar('--cell-hover', 'rgba(255,255,255,0.12)');
    const ensembleLine = cssVar('--temperature-ensemble-line', 'rgba(0,0,0,0.25)');
    const mutedLabel = cssVar('--chart-label-muted', '#666');
    const warmFeels = cssVar('--sunrise-color', '#e65100');
    const coolFeels = cssVar('--precip-prob-40', '#0277bd');
    const tempLabel = cssVar('--thermo-label-text', '#222');
    const neutralFeels = cssVar('--thermo-apparent-neutral', '#888');

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const ens = ensembles[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      const bx = i * COL_WIDTH + BAR_X;

      const yTemp = tempToY(d.temperature);
      const barH = Math.max(2, BAR_BOT - yTemp);

      // ── Highlight for hover/active cell ──
      if (i === activeIndex) {
        ctx.fillStyle = cellHover;
        ctx.fillRect(i * COL_WIDTH, 0, COL_WIDTH, LANE_HEIGHT);
      }

      // ── Temperature bar ──
      ctx.fillStyle = tempColor(d.temperature);
      ctx.fillRect(bx, yTemp, BAR_W, barH);

      // ── Dew point (tiny dot) ──
      const yDew = Math.min(BAR_BOT - 2, Math.max(BAR_TOP + 2, tempToY(d.dewPoint)));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, yDew, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1565c0';
      ctx.beginPath();
      ctx.arc(cx, yDew, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // ── Feels-like side notch at apparent temp ──
      const yApp = tempToY(d.apparentTemp);
      const feelsDiff = d.apparentTemp - d.temperature;
      if (Math.abs(feelsDiff) >= 0.8 && yApp >= BAR_TOP && yApp <= BAR_BOT) {
        const isWarmer = feelsDiff > 0;
        ctx.fillStyle = isWarmer ? warmFeels : coolFeels;
        ctx.beginPath();
        ctx.moveTo(bx - 1, yApp - 2);
        ctx.lineTo(bx - 1, yApp + 2);
        ctx.lineTo(bx - 5, yApp);
        ctx.closePath();
        ctx.fill();
      }

      // ── Ensemble I-beam error bar ──
      if (ens && ens.p10 != null && ens.p90 != null && ens.p10 !== ens.p90) {
        const y10 = Math.max(BAR_TOP, tempToY(ens.p10));
        const y90 = Math.min(BAR_BOT, tempToY(ens.p90));
        ctx.strokeStyle = ensembleLine;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, y10);
        ctx.lineTo(cx, y90);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 2, y10); ctx.lineTo(cx + 2, y10);
        ctx.moveTo(cx - 2, y90); ctx.lineTo(cx + 2, y90);
        ctx.stroke();
      }
    }

    // ── Top labels: temperature + apparent temp (every 3h) ──
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += 3) {
      const d = data[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;

      // Main temperature
      ctx.font = 'bold 10px system-ui';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = tempLabel;
      ctx.fillText(`${Math.round(d.temperature)}°`, cx, TOP_LABEL_H - 2);

      // Apparent temp (small, below main temp, only if differs meaningfully)
      const feelsDiff = d.apparentTemp - d.temperature;
      if (Math.abs(feelsDiff) >= 0.8) {
        ctx.font = '7px system-ui';
        ctx.textBaseline = 'top';
        ctx.fillStyle = Math.abs(feelsDiff) >= 2
          ? (feelsDiff > 0 ? warmFeels : coolFeels)
          : neutralFeels;
        ctx.fillText(`${Math.round(d.apparentTemp)}°`, cx, TOP_LABEL_H - 1);
      }
    }
    ctx.textBaseline = 'alphabetic';

    // ── Bottom labels: humidity every 3h ──
    ctx.font = '8px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i += 3) {
      const d = data[i];
      const cx = i * COL_WIDTH + COL_WIDTH / 2;
      ctx.fillStyle = mutedLabel;
      ctx.fillText(`${Math.round(d.humidity)}%`, cx, LANE_HEIGHT - 2);
    }

  }, [data, minTemp, maxTemp, ensembles, activeIndex]);

  return (
    <div className="lane thermo-hygro-lane" style={{ height: `${LANE_HEIGHT}px`, backgroundColor: 'transparent' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: `${totalWidth}px`, height: `${LANE_HEIGHT}px`, display: 'block', position: 'absolute', top: 0, left: 0, zIndex: 1 }}
        />
        {/* Invisible overlay for hover/click detection */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${totalWidth}px`, height: `${LANE_HEIGHT}px`, display: 'flex', zIndex: 2 }}>
          {data.map((d, i) => (
            <div
              key={i}
              ref={cellRefs[i]}
              style={{
                width: `${COL_WIDTH}px`,
                height: '100%',
                cursor: 'pointer',
              }}
              onPointerEnter={() => setActiveIndex(i)}
              onPointerLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            />
          ))}
        </div>
        {/* Tooltip portal */}
        {activeIndex != null && (
          <ThermoTooltip
            anchorRef={cellRefs[activeIndex]}
            d={data[activeIndex]}
            ens={ensembles[activeIndex]}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
