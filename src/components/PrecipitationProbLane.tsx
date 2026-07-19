import type { WeatherPoint } from '../types/weather';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import {
  createMinutelyChartHorizontalGeometry,
  formatMinutelyTime,
  getMinutelyTimeTickIndices,
} from '../services/minutelyChart';
import { getMinutelyChartTimeParams } from '../services/currentTimePosition';
import './Dashboard.css';

// Gradient from light blue (low prob) to dark blue (high prob)
function probColor(prob: number): string {
  if (prob >= 80) return 'var(--precip-prob-80)';
  if (prob >= 60) return 'var(--precip-prob-60)';
  if (prob >= 40) return 'var(--precip-prob-40)';
  if (prob >= 20) return 'var(--precip-prob-20)';
  return 'var(--precip-prob-low)';
}

function precipColor(code: number | null, alpha = 0.6): string {
  if (code == null) return `rgba(var(--precip-rain-rgb), ${alpha})`;
  if ([95, 96, 99].includes(code)) return `rgba(var(--precip-thunder-rgb), ${alpha})`;
  if ([56, 57, 66, 67].includes(code)) return `rgba(var(--precip-freezing-rgb), ${alpha})`;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `rgba(var(--precip-snow-rgb), ${alpha})`;
  if ([51, 53, 55].includes(code)) return `rgba(var(--precip-drizzle-rgb), ${alpha})`;
  return `rgba(var(--precip-rain-rgb), ${alpha})`;
}

function formatPrecip(value: number | null): string | number {
  if (value == null) return '';
  if (value >= 10) return Math.round(value);
  if (value >= 1) return value.toFixed(1);
  if (value >= 0.1) return value.toFixed(1);
  return '';
}

interface PrecipitationProbLaneProps {
  data: WeatherPoint[];
  compact?: boolean;
  minutelySelection?: MinutelyPrecipitationSelection | null | undefined;
}

export default function PrecipitationProbLane({
  data,
  compact = false,
  minutelySelection = null,
}: PrecipitationProbLaneProps) {
  const layout = useTimelineLayout(data.length);
  const labelInterval = 3;
  const selectedIndex = !compact ? (minutelySelection?.index ?? null) : null;
  const selectedEndIndex = selectedIndex == null ? null : selectedIndex + layout.expandedSpan;
  const minutelyPoints = minutelySelection?.data?.points ?? [];
  const minutelyTicks = getMinutelyTimeTickIndices(
    minutelyPoints,
    30,
    minutelySelection?.item.timezone,
    minutelySelection?.item.utcOffsetSeconds,
  );
  const minutelyTimeParams =
    minutelySelection != null ? getMinutelyChartTimeParams(minutelySelection, layout) : null;
  const minutelyGeometry =
    selectedIndex != null &&
    selectedEndIndex != null &&
    minutelyPoints.length > 0 &&
    minutelyTimeParams != null
      ? createMinutelyChartHorizontalGeometry(
          layout.getColumnLeft(selectedIndex),
          layout.getRangeWidth(selectedIndex, selectedEndIndex),
          minutelyPoints.length,
          minutelyTimeParams,
        )
      : null;

  return (
    <div
      className="lane precip-prob-lane"
      style={{
        height: compact ? '42px' : 'var(--lane-height-precip-prob)',
        backgroundColor: 'transparent',
      }}
    >
      <div className="lane-data">
        {data.map((item, index) => {
          const prob = item.precipitationProb;
          const text = prob != null && prob >= 5 ? `${prob}` : '';
          const precipText = compact ? formatPrecip(item.precipitation) : '';
          const barHeight =
            compact && item.precipitation != null && item.precipitation > 0
              ? Math.min(18, item.precipitation * 2.2)
              : 0;
          const showPrecipText =
            precipText &&
            (index % labelInterval === 0 ||
              (item.precipitation != null && item.precipitation >= 1.5));
          const isMinutelyExpanded =
            selectedIndex != null &&
            selectedEndIndex != null &&
            index >= selectedIndex &&
            index < selectedEndIndex;

          return (
            <div
              key={index}
              className="lane-cell"
              style={{
                width: `${layout.getColumnWidth(index)}px`,
                flexDirection: 'column',
                justifyContent: compact ? 'flex-start' : isMinutelyExpanded ? 'flex-end' : 'center',
                padding: compact ? '2px 0 0' : isMinutelyExpanded ? '0 0 2px' : 0,
              }}
            >
              {compact && barHeight > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '5px',
                    right: '5px',
                    bottom: '13px',
                    height: `${barHeight}px`,
                    backgroundColor: precipColor(item.weatherCode, 0.22),
                    borderRadius: '2px 2px 0 0',
                  }}
                />
              )}
              {!compact &&
                (isMinutelyExpanded || index % labelInterval === 0) &&
                prob != null &&
                text && (
                  <span
                    style={{
                      fontSize: '10px',
                      lineHeight: 1,
                      color: probColor(prob),
                      fontWeight: 'bold',
                      zIndex: 1,
                    }}
                  >
                    {text}%
                  </span>
                )}
              {compact && showPrecipText && (
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    fontSize: '9px',
                    lineHeight: 1,
                    color: precipColor(item.weatherCode, 1),
                    fontWeight: 'bold',
                    WebkitTextStroke: '2px var(--label-stroke)',
                    paintOrder: 'stroke fill',
                    zIndex: 1,
                  }}
                >
                  {precipText}
                </span>
              )}
              {compact && index % labelInterval === 0 && prob != null && text && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    fontSize: '10px',
                    lineHeight: 1,
                    color: probColor(prob),
                    fontWeight: 'bold',
                    zIndex: 1,
                  }}
                >
                  {text}%
                </span>
              )}
            </div>
          );
        })}
        {minutelyGeometry && minutelySelection?.status === 'success' && (
          <div className="minutely-time-axis" aria-hidden="true">
            {minutelyTicks.map((pointIndex) => {
              const point = minutelyPoints[pointIndex];
              if (!point) return null;
              return (
                <span
                  key={`${point.fxTime}-${pointIndex}`}
                  className="minutely-time-axis-tick"
                  style={{ left: `${minutelyGeometry.getPointCenter(pointIndex)}px` }}
                >
                  {formatMinutelyTime(
                    point.fxTime,
                    minutelySelection.item.timezone,
                    minutelySelection.item.utcOffsetSeconds,
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
