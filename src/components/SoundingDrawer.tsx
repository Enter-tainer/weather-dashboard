import { useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SkewT } from 'skewt';
import 'skewt/style.css';
import { detectInversions, toSkewtFormat, withSurfaceLevel } from '../services/sounding';
import type { SoundingLevel, WeatherPoint } from '../types/weather';

interface SkewTChartProps {
  item: WeatherPoint;
}

interface SoundingDrawerProps {
  item: WeatherPoint;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}

function formatTime(item: WeatherPoint): string {
  const date = new Date(item.time);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, '0');
  return `${month}/${day} ${hour}:00`;
}

function round(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

function formatHeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  return `${Math.round(value)} m`;
}

function SkewTChart({ item }: SkewTChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<SkewT | null>(null);

  const soundingData = useMemo(() => {
    const levels = withSurfaceLevel(item)
      .filter((level): level is SoundingLevel & { temp: number } => level.pressure > 0 && level.temp != null)
      .sort((a, b) => b.pressure - a.pressure);
    return levels;
  }, [item]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el || soundingData.length < 3) return;

    // Recreate chart on each item change (SkewT caches previous plot state)
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const chart = new SkewT(el, {
      unit: 'ms',
    });

    const formatted = toSkewtFormat(soundingData);
    if (formatted.length >= 3) {
      chart.plot(formatted);
    }

    chartInstance.current = chart;

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [soundingData]);

  return (
    <div className="sounding-chart-shell">
      <div className="sounding-chart" ref={chartRef} />
    </div>
  );
}

export default function SoundingDrawer({ item, index, total, onClose, onStep }: SoundingDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const inversions = useMemo(() => detectInversions(item), [item]);
  const spread = item.temperature != null && item.dewPoint != null ? item.temperature - item.dewPoint : null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Close on pointerdown outside the drawer (capture phase — fires before React handlers)
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const drawer = drawerRef.current;
      if (drawer && event.target instanceof Node && !drawer.contains(event.target)) {
        onCloseRef.current();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll while drawer is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close when clicking the backdrop itself (not the drawer)
    if (e.target === e.currentTarget) onClose();
  };

  const firstInversion = inversions[0];

  return (
    <div
      className="sounding-backdrop"
      onClick={handleBackdropClick}
      aria-label="关闭 Skew-T 面板"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
    <aside className="sounding-drawer" ref={drawerRef} aria-label="Skew-T 探空图" onClick={(e) => e.stopPropagation()}>
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
          <strong>{firstInversion ? `${formatHeight(firstInversion.baseM)}-${formatHeight(firstInversion.topM)}` : 'none'}</strong>
        </div>
      </div>

    </aside>
    </div>
  );
}
