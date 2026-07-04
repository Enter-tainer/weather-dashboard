import { useMemo, useRef, useEffect, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SkewT } from 'skewt';
import 'skewt/style.css';
import { detectInversions, toSkewtFormat, withSurfaceLevel } from '../services/sounding';
import type { CloudLevel, SoundingLevel, WeatherPoint } from '../types/weather';

interface SkewTChartProps {
  item: WeatherPoint;
}

interface CloudLayerProfileProps {
  item: WeatherPoint;
}

interface CloudProfileLevel {
  key: string;
  pressure: number | null;
  label: string;
  cover: number | null;
  altitude: number | null;
  temp: number | null;
  dewPoint: number | null;
  relativeHumidity: number | null;
  windSpeed: number | null;
  windDir: number | null;
}

interface SoundingDrawerProps {
  item: WeatherPoint;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}

const FALLBACK_ALTITUDES: Readonly<Record<number, number>> = {
  1000: 110,
  975: 320,
  950: 500,
  925: 800,
  900: 1000,
  850: 1500,
  800: 1900,
  700: 3000,
  600: 4200,
  500: 5600,
  400: 7200,
  300: 9200,
  250: 10800,
  200: 12300,
};

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

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function formatHeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  return `${Math.round(value)} m`;
}

function formatTemp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value.toFixed(1)}°`;
}

function formatPressure(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return `${Math.round(value)} hPa`;
}

function formatWind(
  speed: number | null | undefined,
  direction: number | null | undefined,
): string {
  if (speed == null || !Number.isFinite(speed)) return '-';
  const roundedSpeed = Math.round(speed);
  if (direction == null || !Number.isFinite(direction)) return `${roundedSpeed}km/h`;
  return `${roundedSpeed}km/h ${Math.round(direction)}°`;
}

function formatCloudCover(value: number | null | undefined): string {
  const cover = clampPercent(value);
  return cover == null ? '-' : `${Math.round(cover)}%`;
}

function levelTitle(level: CloudProfileLevel): string {
  const spread = level.temp != null && level.dewPoint != null ? level.temp - level.dewPoint : null;
  return [
    formatHeight(level.altitude),
    formatPressure(level.pressure),
    `云量 ${formatCloudCover(level.cover)}`,
    `T ${formatTemp(level.temp)}`,
    `RH ${level.relativeHumidity == null ? '-' : `${round(level.relativeHumidity)}%`}`,
    `T-Td ${formatTemp(spread)}`,
    `W ${formatWind(level.windSpeed, level.windDir)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function cloudBandLabel(altitude: number | null): string {
  if (altitude == null) return '层';
  if (altitude >= 6000) return '高';
  if (altitude >= 2000) return '中';
  return '低';
}

function soundingByPressure(levels: SoundingLevel[] | undefined): Map<number, SoundingLevel> {
  const byPressure = new Map<number, SoundingLevel>();
  for (const level of levels || []) {
    byPressure.set(level.pressure, level);
  }
  return byPressure;
}

function altitudeForLevel(
  pressure: number | null,
  cloud: CloudLevel | null,
  sounding: SoundingLevel | null,
): number | null {
  return (
    cloud?.altitude ??
    sounding?.altitude ??
    sounding?.agl ??
    (pressure != null ? (FALLBACK_ALTITUDES[pressure] ?? null) : null)
  );
}

function cloudProfileLevels(item: WeatherPoint): CloudProfileLevel[] {
  const soundingLevels = soundingByPressure(item.soundingLevels);
  const cloudLevels = item.cloudByLevel || [];

  if (cloudLevels.length > 0) {
    return cloudLevels
      .map((cloud) => {
        const sounding = soundingLevels.get(cloud.pressure) ?? null;
        const altitude = altitudeForLevel(cloud.pressure, cloud, sounding);
        return {
          key: `pressure-${cloud.pressure}`,
          pressure: cloud.pressure,
          label: cloudBandLabel(altitude),
          cover: clampPercent(cloud.cover),
          altitude,
          temp: sounding?.temp ?? null,
          dewPoint: sounding?.dewPoint ?? null,
          relativeHumidity: sounding?.relativeHumidity ?? null,
          windSpeed: sounding?.windSpeed ?? null,
          windDir: sounding?.windDir ?? null,
        };
      })
      .sort((a, b) => {
        const aHeight =
          a.altitude ?? (a.pressure != null ? FALLBACK_ALTITUDES[a.pressure] : null) ?? -1;
        const bHeight =
          b.altitude ?? (b.pressure != null ? FALLBACK_ALTITUDES[b.pressure] : null) ?? -1;
        return bHeight - aHeight;
      });
  }

  if (item.soundingLevels && item.soundingLevels.length > 0) {
    return item.soundingLevels
      .map((level) => {
        const altitude = altitudeForLevel(level.pressure, null, level);
        return {
          key: `sounding-${level.pressure}`,
          pressure: level.pressure,
          label: cloudBandLabel(altitude),
          cover: null,
          altitude,
          temp: level.temp,
          dewPoint: level.dewPoint,
          relativeHumidity: level.relativeHumidity,
          windSpeed: level.windSpeed,
          windDir: level.windDir,
        };
      })
      .sort((a, b) => (b.altitude ?? -1) - (a.altitude ?? -1));
  }

  return [
    {
      key: 'high',
      pressure: null,
      label: '高云',
      cover: clampPercent(item.cloudHigh),
      altitude: 8000,
    },
    {
      key: 'mid',
      pressure: null,
      label: '中云',
      cover: clampPercent(item.cloudMid),
      altitude: 4000,
    },
    {
      key: 'low',
      pressure: null,
      label: '低云',
      cover: clampPercent(item.cloudLow),
      altitude: 1000,
    },
  ].map((level) => ({
    ...level,
    temp: null,
    dewPoint: null,
    relativeHumidity: null,
    windSpeed: null,
    windDir: null,
  }));
}

function SkewTChart({ item }: SkewTChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<SkewT | null>(null);

  const soundingData = useMemo(() => {
    const levels = withSurfaceLevel(item)
      .filter(
        (level): level is SoundingLevel & { temp: number } =>
          level.pressure > 0 && level.temp != null,
      )
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
      <div className="sounding-section-heading">
        <div>
          <div className="sounding-kicker">Thermodynamic profile</div>
          <div className="sounding-section-title">Skew-T Log-P</div>
        </div>
      </div>
      <div className="sounding-chart" ref={chartRef} />
    </div>
  );
}

function CloudLayerProfile({ item }: CloudLayerProfileProps) {
  const levels = useMemo(() => cloudProfileLevels(item), [item]);
  const { maxCloudLevel, cloudBaseLevel, moistestLevel } = useMemo(() => {
    const cloudyLevels = levels.filter((level) => level.cover != null);
    const maxCloud = cloudyLevels.reduce<CloudProfileLevel | null>((max, level) => {
      if (max == null) return level;
      return (level.cover ?? -1) > (max.cover ?? -1) ? level : max;
    }, null);

    const activeCloudLevels = cloudyLevels.filter((level) => (level.cover ?? 0) >= 3);
    const cloudBase = activeCloudLevels.reduce<CloudProfileLevel | null>((base, level) => {
      if (base == null) return level;
      return (level.altitude ?? Infinity) < (base.altitude ?? Infinity) ? level : base;
    }, null);

    const moistest = levels.reduce<CloudProfileLevel | null>((max, level) => {
      if (level.relativeHumidity == null) return max;
      if (max == null || max.relativeHumidity == null) return level;
      return level.relativeHumidity > max.relativeHumidity ? level : max;
    }, null);

    return {
      maxCloudLevel: maxCloud,
      cloudBaseLevel: cloudBase,
      moistestLevel: moistest,
    };
  }, [levels]);

  return (
    <section className="cloud-profile-section" aria-label="高度层云况">
      <div className="sounding-section-heading">
        <div>
          <div className="sounding-kicker">Cloud layers</div>
          <div className="sounding-section-title">高度层云况</div>
        </div>
        <div className="cloud-profile-headline">
          <span>Max</span>
          <strong>
            {maxCloudLevel
              ? `${formatCloudCover(maxCloudLevel.cover)} · ${formatHeight(maxCloudLevel.altitude)}`
              : '-'}
          </strong>
        </div>
      </div>

      <div className="cloud-profile-chart" role="img" aria-label="各高度层云量、温度、湿度剖面">
        <div className="cloud-profile-plot">
          {levels.map((level) => {
            const cover = level.cover ?? 0;
            const coverAlpha = level.cover == null ? 0 : Math.min(0.72, 0.12 + cover / 135);
            const rowStyle = {
              '--cloud-profile-cover': `${cover}%`,
              '--cloud-profile-alpha': coverAlpha,
            } as CSSProperties;

            return (
              <div
                className="cloud-profile-level-row"
                key={level.key}
                style={rowStyle}
                title={levelTitle(level)}
              >
                <div className="cloud-profile-height">
                  <span className="cloud-profile-band">{level.label}</span>
                  <div>
                    <strong>{formatHeight(level.altitude)}</strong>
                    <span>{formatPressure(level.pressure)}</span>
                  </div>
                </div>

                <div
                  className="cloud-profile-cover"
                  aria-label={`云量 ${formatCloudCover(level.cover)}`}
                >
                  <div className="cloud-profile-track">
                    <div className="cloud-profile-fill" />
                  </div>
                  <strong>{formatCloudCover(level.cover)}</strong>
                </div>

                <div className="cloud-profile-metrics">
                  <span>
                    <b>T</b>
                    {formatTemp(level.temp)}
                  </span>
                  <span>
                    <b>RH</b>
                    {level.relativeHumidity == null ? '-' : `${round(level.relativeHumidity)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cloud-profile-readouts">
          <div>
            <span>Max cloud</span>
            <strong>
              {maxCloudLevel
                ? `${formatCloudCover(maxCloudLevel.cover)} · ${formatHeight(maxCloudLevel.altitude)}`
                : '-'}
            </strong>
            <em>
              {maxCloudLevel
                ? `T ${formatTemp(maxCloudLevel.temp)} · RH ${maxCloudLevel.relativeHumidity == null ? '-' : `${round(maxCloudLevel.relativeHumidity)}%`}`
                : '-'}
            </em>
          </div>
          <div>
            <span>Cloud base</span>
            <strong>
              {cloudBaseLevel
                ? `${formatHeight(cloudBaseLevel.altitude)} · ${formatPressure(cloudBaseLevel.pressure)}`
                : '-'}
            </strong>
            <em>
              {cloudBaseLevel
                ? `W ${formatWind(cloudBaseLevel.windSpeed, cloudBaseLevel.windDir)}`
                : '-'}
            </em>
          </div>
          <div>
            <span>Moist layer</span>
            <strong>
              {moistestLevel
                ? `${moistestLevel.relativeHumidity == null ? '-' : `${round(moistestLevel.relativeHumidity)}%`} · ${formatHeight(moistestLevel.altitude)}`
                : '-'}
            </strong>
            <em>
              {moistestLevel
                ? `T-Td ${formatTemp(moistestLevel.temp != null && moistestLevel.dewPoint != null ? moistestLevel.temp - moistestLevel.dewPoint : null)}`
                : '-'}
            </em>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SoundingDrawer({
  item,
  index,
  total,
  onClose,
  onStep,
}: SoundingDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const inversions = useMemo(() => detectInversions(item), [item]);
  const spread =
    item.temperature != null && item.dewPoint != null ? item.temperature - item.dewPoint : null;

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
    return () => {
      document.body.style.overflow = original;
    };
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClose();
      }}
    >
      <aside
        className="sounding-drawer"
        ref={drawerRef}
        aria-label="Skew-T 探空图"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sounding-header">
          <div>
            <div className="sounding-kicker">Sounding profile</div>
            <div className="sounding-title">Sounding detail</div>
            <div className="sounding-subtitle">
              {item.cityName} · {formatTime(item)}
            </div>
          </div>
          <button
            type="button"
            className="sounding-icon-btn"
            onClick={onClose}
            aria-label="关闭 Skew-T"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sounding-nav" aria-label="切换探空时次">
          <button
            type="button"
            className="sounding-step-btn"
            onClick={() => onStep(-1)}
            disabled={index <= 0}
            aria-label="上一小时"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {index + 1} / {total}
          </span>
          <button
            type="button"
            className="sounding-step-btn"
            onClick={() => onStep(1)}
            disabled={index >= total - 1}
            aria-label="下一小时"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="sounding-chart-stack">
          <CloudLayerProfile item={item} />
          <SkewTChart item={item} />
        </div>

        <div className="sounding-summary">
          <div>
            <span>T / Td</span>
            <strong>
              {round(item.temperature, 1)} / {round(item.dewPoint, 1)}°C
            </strong>
          </div>
          <div>
            <span>Spread</span>
            <strong>{round(spread, 1)}°C</strong>
          </div>
          <div>
            <span>Wind</span>
            <strong>
              {round(item.windSpeed)} km/h · {round(item.windDir)}°
            </strong>
          </div>
          <div>
            <span>Inversion</span>
            <strong>
              {firstInversion
                ? `${formatHeight(firstInversion.baseM)}-${formatHeight(firstInversion.topM)}`
                : 'none'}
            </strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
