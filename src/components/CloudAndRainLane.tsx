import { useCanvas } from '../hooks/useCanvas';
import { CloudRain } from 'lucide-react';
import { useMemo } from 'react';
import {
  createMinutelyChartHorizontalGeometry,
  formatMinutelyTime,
  getHourlyPrecipBarHeight,
  getMinutelyPrecipBarHeight,
  getMinutelyTimeTickIndices,
  PRECIP_BAR_MAX_HEIGHT,
  PRECIP_INTENSITY_BANDS,
} from '../services/minutelyChart';
import { cssVar } from '../services/themeColors';
import {
  CLOUD_AND_RAIN_LANE_HEIGHT,
  CLOUD_PLOT_HEIGHT,
  cloudAltitudeToY,
  PRECIPITATION_PLOT_HEIGHT,
  PRECIPITATION_PLOT_TOP,
} from '../services/cloudAndRainScale';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

const EMPTY_MINUTELY_POINTS: NonNullable<MinutelyPrecipitationSelection['data']>['points'] = [];
const EMPTY_MINUTELY_INDICES = new Set<number>();

// Fallback altitudes (meters) when geopotential height is unavailable
const FALLBACK_ALT: Readonly<Record<number, number>> = {
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
};

interface CloudAndRainLaneProps {
  data: WeatherPoint[];
  hourWidth?: number;
  minutelySelection?: MinutelyPrecipitationSelection | null | undefined;
  minutelyAvailableIndices?: Set<number> | undefined;
  onMinutelySelect?: ((index: number) => void) | undefined;
}

// Grid lines at key altitudes matching the legend sidebar
const GRID_ALTS = [1000, 2000, 4000, 5000, 6000, 8000, 10000];
// Cloud classification boundaries get thicker lines
const BOUNDARY_ALTS = new Set([2000, 6000]);

function getCloudAltitude(pressure: number, altitude: number | null): number | null {
  return altitude ?? FALLBACK_ALT[pressure] ?? null;
}

// Precipitation color by weather code type
function precipColor(code: number | null, alpha = 0.6): string {
  if (code == null) return `rgba(${cssVar('--precip-rain-rgb', '13, 71, 161')}, ${alpha})`;
  if ([95, 96, 99].includes(code))
    return `rgba(${cssVar('--precip-thunder-rgb', '107, 33, 168')}, ${alpha})`;
  if ([56, 57, 66, 67].includes(code))
    return `rgba(${cssVar('--precip-freezing-rgb', '139, 92, 246')}, ${alpha})`;
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return `rgba(${cssVar('--precip-snow-rgb', '56, 189, 248')}, ${alpha})`;
  if ([51, 53, 55].includes(code))
    return `rgba(${cssVar('--precip-drizzle-rgb', '96, 165, 250')}, ${alpha})`;
  return `rgba(${cssVar('--precip-rain-rgb', '13, 71, 161')}, ${alpha})`;
}

function precipCssColor(code: number | null, alpha = 0.6): string {
  if (code == null) return `rgba(var(--precip-rain-rgb), ${alpha})`;
  if ([95, 96, 99].includes(code)) return `rgba(var(--precip-thunder-rgb), ${alpha})`;
  if ([56, 57, 66, 67].includes(code)) return `rgba(var(--precip-freezing-rgb), ${alpha})`;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `rgba(var(--precip-snow-rgb), ${alpha})`;
  if ([51, 53, 55].includes(code)) return `rgba(var(--precip-drizzle-rgb), ${alpha})`;
  return `rgba(var(--precip-rain-rgb), ${alpha})`;
}

function formatMinutelyPrecipLabel(precip: number): string {
  if (precip >= 10) return Math.round(precip).toString();
  if (precip >= 1) return precip.toFixed(1);
  if (precip >= 0.05) return precip.toFixed(2).replace(/0$/, '');
  return '<0.05';
}

// Uniform cloud color — only alpha varies with coverage
function cloudColor(cover: number, rgb: string, alphaScale: number): string {
  const alpha = (cover / 100) * alphaScale;
  return `rgba(${rgb}, ${alpha})`;
}

export default function CloudAndRainLane({
  data,
  hourWidth = DEFAULT_HOUR_WIDTH,
  minutelySelection = null,
  minutelyAvailableIndices = EMPTY_MINUTELY_INDICES,
  onMinutelySelect,
}: CloudAndRainLaneProps) {
  const layout = useTimelineLayout(data.length, hourWidth);
  const width = layout.totalWidth;
  const precipBarWidth = Math.max(2, Math.min(8, hourWidth * 0.7));
  const showPrecipLabels = hourWidth >= 12;
  const selectedIndex = minutelySelection?.index ?? null;
  const selectedEndIndex = selectedIndex == null ? null : selectedIndex + layout.expandedSpan;
  const minutelyPoints = minutelySelection?.data?.points ?? EMPTY_MINUTELY_POINTS;
  const minutelyPointCount = minutelyPoints.length;
  const minutelyTicks = useMemo(
    () =>
      getMinutelyTimeTickIndices(
        minutelyPoints,
        30,
        minutelySelection?.item.timezone,
        minutelySelection?.item.utcOffsetSeconds,
      ),
    [minutelyPoints, minutelySelection?.item.timezone, minutelySelection?.item.utcOffsetSeconds],
  );
  const minutelyLabelGeometry =
    selectedIndex != null && selectedEndIndex != null && minutelyPointCount > 0
      ? createMinutelyChartHorizontalGeometry(
          0,
          layout.getRangeWidth(selectedIndex, selectedEndIndex),
          minutelyPointCount,
        )
      : null;
  const availableStartIndex =
    minutelyAvailableIndices.size > 0 ? Math.min(...minutelyAvailableIndices) : null;

  const canvasRef = useCanvas(
    width,
    CLOUD_AND_RAIN_LANE_HEIGHT,
    (ctx, w, h) => {
      const cloudFillRgb = cssVar('--cloud-fill-rgb', '90, 90, 100');
      const cloudFillAlphaScale =
        Number.parseFloat(cssVar('--cloud-fill-alpha-scale', '0.85')) || 0.85;

      ctx.fillStyle = cssVar('--cloud-layer-bg', 'rgba(230, 232, 235, 0.3)');
      ctx.fillRect(0, 0, w, CLOUD_PLOT_HEIGHT);
      ctx.fillStyle = cssVar('--precip-strip-bg', 'rgba(13, 71, 161, 0.035)');
      ctx.fillRect(0, PRECIPITATION_PLOT_TOP, w, PRECIPITATION_PLOT_HEIGHT);

      // Altitude grid lines (cloud boundaries thicker)
      for (const alt of GRID_ALTS) {
        const isBoundary = BOUNDARY_ALTS.has(alt);
        ctx.setLineDash(isBoundary ? [6, 4] : [4, 6]);
        ctx.strokeStyle = isBoundary
          ? cssVar('--cloud-grid-boundary', 'rgba(0,0,0,0.25)')
          : cssVar('--cloud-grid-line', 'rgba(0,0,0,0.12)');
        ctx.lineWidth = isBoundary ? 1.2 : 0.5;
        const y = cloudAltitudeToY(alt);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw cloud layers for each hour
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (!d) continue;
        const x = layout.getColumnLeft(i);
        const columnWidth = layout.getColumnWidth(i);

        if (d.cloudByLevel) {
          for (let li = 0; li < d.cloudByLevel.length - 1; li++) {
            const lower = d.cloudByLevel[li];
            const upper = d.cloudByLevel[li + 1];
            if (!lower || !upper) continue;
            if (lower.cover == null && upper.cover == null) continue;
            const cover = Math.max(lower.cover ?? 0, upper.cover ?? 0);
            if (cover < 3) continue;

            const altLow = getCloudAltitude(lower.pressure, lower.altitude);
            const altHigh = getCloudAltitude(upper.pressure, upper.altitude);
            if (altLow == null || altHigh == null) continue;

            const yTop = cloudAltitudeToY(altHigh);
            const yBot = cloudAltitudeToY(altLow);
            if (yBot - yTop <= 0) continue;

            ctx.fillStyle = cloudColor(cover, cloudFillRgb, cloudFillAlphaScale);
            ctx.fillRect(x, yTop, columnWidth + 1, yBot - yTop);
          }
        } else {
          // Fallback: use low/mid/high cloud cover
          const layers = [
            { cover: d.cloudLow, altLow: 0, altHigh: 2000 },
            { cover: d.cloudMid, altLow: 2000, altHigh: 6000 },
            { cover: d.cloudHigh, altLow: 6000, altHigh: 10000 },
          ];
          for (const layer of layers) {
            if (layer.cover == null || layer.cover < 3) continue;
            const yTop = cloudAltitudeToY(layer.altHigh);
            const yBot = cloudAltitudeToY(layer.altLow);

            ctx.fillStyle = cloudColor(layer.cover, cloudFillRgb, cloudFillAlphaScale);
            ctx.fillRect(x, yTop, columnWidth + 1, yBot - yTop);
          }
        }

        if (
          selectedIndex != null &&
          selectedEndIndex != null &&
          i >= selectedIndex &&
          i < selectedEndIndex
        ) {
          if (i !== selectedIndex) continue;
          const detailWidth = layout.getRangeWidth(selectedIndex, selectedEndIndex);
          const chartX = createMinutelyChartHorizontalGeometry(x, detailWidth, minutelyPointCount);
          const chartTop = h - PRECIP_BAR_MAX_HEIGHT - 0.5;
          const chartBottom = h - 0.5;

          ctx.save();
          ctx.lineWidth = 1;
          ctx.strokeStyle = cssVar('--lane-border', 'rgba(0,0,0,0.12)');
          ctx.beginPath();
          ctx.moveTo(chartX.plotLeft, chartBottom);
          ctx.lineTo(chartX.plotRight, chartBottom);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(chartX.plotLeft + 0.5, chartTop);
          ctx.lineTo(chartX.plotLeft + 0.5, chartBottom);
          ctx.stroke();

          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 0.5;
          for (const pointIndex of minutelyTicks) {
            const tickX = chartX.getPointCenter(pointIndex);
            ctx.beginPath();
            ctx.moveTo(tickX, chartTop);
            ctx.lineTo(tickX, chartBottom);
            ctx.stroke();
          }
          ctx.setLineDash([]);

          if (minutelySelection?.status === 'success') {
            for (let pointIndex = 0; pointIndex < minutelyPoints.length; pointIndex++) {
              const point = minutelyPoints[pointIndex];
              if (!point) continue;
              const centerX = chartX.getPointCenter(pointIndex);
              const barWidth = Math.max(2, Math.min(8, chartX.slotWidth - 2));
              const barHeight = getMinutelyPrecipBarHeight(point.precip);

              ctx.fillStyle = precipColor(
                point.type === 'snow' ? 71 : minutelySelection.item.weatherCode,
                0.18,
              );
              ctx.fillRect(centerX - barWidth / 2, chartBottom - 1, barWidth, 1);

              if (barHeight > 0) {
                ctx.fillStyle = precipColor(
                  point.type === 'snow' ? 71 : minutelySelection.item.weatherCode,
                  0.82,
                );
                ctx.fillRect(centerX - barWidth / 2, chartBottom - barHeight, barWidth, barHeight);
              }
            }
          }
          ctx.restore();
          continue;
        }

        // Ensemble precipitation (background)
        if (d.precipMembers && d.precipMembers.length > 0) {
          ctx.fillStyle = `rgba(${cssVar('--precip-rain-rgb', '13, 71, 161')}, 0.08)`;
          d.precipMembers.forEach((precip) => {
            if (precip > 0.1) {
              const barHeight = getHourlyPrecipBarHeight(precip);
              ctx.fillRect(x, h - barHeight, columnWidth, barHeight);
            }
          });
        }

        // Main precipitation bar — colored by type
        if (d.precipitation != null && d.precipitation > 0) {
          const barHeight = getHourlyPrecipBarHeight(d.precipitation);
          ctx.fillStyle = precipColor(d.weatherCode, 0.5);
          ctx.fillRect(
            x + columnWidth / 2 - precipBarWidth / 2,
            h - barHeight,
            precipBarWidth,
            barHeight,
          );
        }
      }

      // One shared rain-intensity scale for hourly and five-minute precipitation.
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 0.75;
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = cssVar('--precip-prob-60', '#0277bd');
      for (const band of PRECIP_INTENSITY_BANDS) {
        const y = h - getHourlyPrecipBarHeight(band.maxRate) - 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // Boundary layer height — dashed line across all hours
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = cssVar('--blh-line', 'rgba(180, 120, 60, 0.6)');
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < data.length; i++) {
        if (
          selectedIndex != null &&
          selectedEndIndex != null &&
          i >= selectedIndex &&
          i < selectedEndIndex
        ) {
          started = false;
          continue;
        }
        const blh = data[i]?.boundaryLayerHeight;
        if (blh == null) {
          started = false;
          continue;
        }
        const x = layout.getColumnCenter(i);
        const y = cloudAltitudeToY(blh);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [
      data,
      layout,
      minutelyPoints,
      minutelySelection,
      minutelyPointCount,
      minutelyTicks,
      precipBarWidth,
      selectedIndex,
      selectedEndIndex,
    ],
  );

  return (
    <div
      className="lane cloud-rain-lane"
      style={{ height: `${CLOUD_AND_RAIN_LANE_HEIGHT}px`, position: 'relative' }}
    >
      <div className="lane-data" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${CLOUD_AND_RAIN_LANE_HEIGHT}px`,
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${CLOUD_AND_RAIN_LANE_HEIGHT}px`,
            display: 'flex',
            zIndex: 2,
          }}
        >
          {data.map((item, index) => {
            const barHeight =
              item.precipitation != null && item.precipitation > 0
                ? getHourlyPrecipBarHeight(item.precipitation)
                : 0;
            const isMinutelyExpanded =
              selectedIndex != null &&
              selectedEndIndex != null &&
              index >= selectedIndex &&
              index < selectedEndIndex;
            const isMinutelyClickable =
              !minutelySelection &&
              availableStartIndex != null &&
              index >= availableStartIndex &&
              index < Math.min(data.length, availableStartIndex + 2) &&
              !!onMinutelySelect;
            return (
              <div
                key={index}
                className="lane-cell"
                style={{
                  width: `${layout.getColumnWidth(index)}px`,
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  paddingBottom: `${barHeight + 2}px`,
                }}
              >
                {isMinutelyClickable && (
                  <button
                    type="button"
                    className="minutely-rain-hit-target"
                    onClick={() => onMinutelySelect?.(availableStartIndex)}
                    aria-label="展开未来两小时的 5 分钟降水"
                    title="展开未来两小时的 5 分钟降水"
                  >
                    {index === availableStartIndex && (
                      <span
                        className="minutely-rain-hint"
                        style={{
                          width: `${layout.getRangeWidth(
                            availableStartIndex,
                            Math.min(data.length, availableStartIndex + 2),
                          )}px`,
                        }}
                        aria-hidden="true"
                      >
                        <CloudRain size={10} />
                        <span>5m</span>
                      </span>
                    )}
                  </button>
                )}
                {showPrecipLabels && item.precipitation != null && item.precipitation > 0 && (
                  <span
                    className={[
                      'hourly-precip-label',
                      isMinutelyExpanded ? 'is-minutely-reference' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`小时降水 ${item.precipitation.toFixed(1)} 毫米`}
                    title={`Open-Meteo 小时降水 ${item.precipitation.toFixed(1)} mm`}
                    style={{
                      color: precipCssColor(item.weatherCode, 1),
                      fontSize: '9px',
                      fontWeight: 'bold',
                      WebkitTextStroke: '2px var(--label-stroke)',
                      paintOrder: 'stroke fill',
                    }}
                  >
                    {item.precipitation.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {minutelySelection && (
          <div
            className={['minutely-rain-inline', onMinutelySelect ? 'is-collapsible' : '']
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `${layout.getColumnLeft(minutelySelection.index)}px`,
              width: `${layout.getRangeWidth(
                minutelySelection.index,
                Math.min(data.length, minutelySelection.index + layout.expandedSpan),
              )}px`,
            }}
            role={onMinutelySelect ? 'button' : undefined}
            tabIndex={onMinutelySelect ? 0 : undefined}
            aria-label={onMinutelySelect ? '收起 5 分钟降水' : undefined}
            title={onMinutelySelect ? '点击收起' : undefined}
            onClick={onMinutelySelect ? () => onMinutelySelect(minutelySelection.index) : undefined}
            onKeyDown={
              onMinutelySelect
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onMinutelySelect(minutelySelection.index);
                    }
                  }
                : undefined
            }
          >
            {minutelySelection.data?.summary && (
              <div className="minutely-rain-inline-header">
                <div
                  className="minutely-rain-inline-summary"
                  title={minutelySelection.data.summary}
                >
                  {minutelySelection.data.summary}
                </div>
              </div>
            )}
            {minutelySelection.status === 'success' && minutelyLabelGeometry && (
              <div className="minutely-rain-value-labels">
                {minutelyPoints.map((point, pointIndex) => {
                  if (point.precip <= 0 || pointIndex % 3 !== 1) return null;
                  return (
                    <span
                      key={`${point.fxTime}-${pointIndex}`}
                      className="minutely-rain-value-label"
                      aria-label={`5分钟降水 ${point.precip.toFixed(2)} 毫米`}
                      title={`${formatMinutelyTime(
                        point.fxTime,
                        minutelySelection.item.timezone,
                        minutelySelection.item.utcOffsetSeconds,
                      )} · ${point.precip.toFixed(2)} mm / 5min`}
                      style={{
                        left: `${minutelyLabelGeometry.getPointCenter(pointIndex)}px`,
                        bottom: `${getMinutelyPrecipBarHeight(point.precip) + 2}px`,
                        color: precipCssColor(
                          point.type === 'snow' ? 71 : minutelySelection.item.weatherCode,
                          1,
                        ),
                      }}
                    >
                      {formatMinutelyPrecipLabel(point.precip)}
                    </span>
                  );
                })}
              </div>
            )}
            {minutelySelection.status === 'loading' && (
              <div className="minutely-rain-inline-message" role="status">
                <span className="loading-spinner" /> 正在加载 5 分钟预报…
              </div>
            )}
            {minutelySelection.status === 'error' && (
              <div className="minutely-rain-inline-message is-error" role="alert">
                {minutelySelection.error}
              </div>
            )}
            {minutelySelection.status === 'success' && minutelyPoints.length === 0 && (
              <div className="minutely-rain-inline-message">未来两小时没有可用的 5 分钟预报点</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
