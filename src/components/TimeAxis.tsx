import { Sunrise, Sunset, Moon } from 'lucide-react';
import type { SunEvent, WeatherPoint, WeatherTimeline } from '../types/weather';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import './Dashboard.css';

interface IndexedWeatherPoint {
  item: WeatherPoint;
  index: number;
}

interface CityGroup {
  cityName: string;
  startIndex: number;
  items: IndexedWeatherPoint[];
}

interface DayGroup {
  dateKey: string;
  dateStr: string;
  items: IndexedWeatherPoint[];
  startIndex: number;
  moonPhase?: number | undefined;
  moonFraction?: number | undefined;
}

interface TimeAxisProps {
  data: WeatherTimeline;
  hourWidth?: number;
  hoursPerColumn?: number;
  onSelectSunEvent?: ((ev: SunEvent) => void) | undefined;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function getMoonPhaseName(phase: number): string {
  if (phase < 0.0625) return '新月';
  if (phase < 0.1875) return '蛾眉月';
  if (phase < 0.3125) return '上弦月';
  if (phase < 0.4375) return '盈凸月';
  if (phase < 0.5625) return '满月';
  if (phase < 0.6875) return '亏凸月';
  if (phase < 0.8125) return '下弦月';
  if (phase < 0.9375) return '残月';
  return '新月';
}

function formatDateLabel(dateKey: string): string {
  const dateObj: Date = new Date(`${dateKey}T00:00:00`);
  const weekday = WEEKDAY_LABELS[dateObj.getDay()] ?? '';
  return `${weekday} ${dateObj.getDate()}`;
}

export default function TimeAxis({
  data,
  hourWidth = DEFAULT_HOUR_WIDTH,
  hoursPerColumn = 1,
  onSelectSunEvent,
}: TimeAxisProps) {
  const layout = useTimelineLayout(data.length, hourWidth);
  const dashboardLayout = useDashboardLayout();
  const hourLabelInterval = 3;
  const eventLabelFontSize = dashboardLayout.mode === 'reader' ? '13px' : '9px';
  const eventIconSize = dashboardLayout.mode === 'reader' ? 14 : 10;
  const hourGridTop = Math.max(40, dashboardLayout.timeAxisHeight - 10);
  const sunEventTop = dashboardLayout.mode === 'reader' ? dashboardLayout.timeAxisHeight - 28 : 34;
  const moonEventTop = dashboardLayout.mode === 'reader' ? 18 : 16;
  const showAggregateLabels = hoursPerColumn > 1;
  const shouldShowHourLabel = (hour: number, index: number): boolean =>
    showAggregateLabels || layout.isExpandedColumn(index) || hour % hourLabelInterval === 0;
  const shouldShowGridLine = (hour: number, index: number): boolean =>
    showAggregateLabels || layout.isExpandedColumn(index) || hour % hourLabelInterval === 0;
  // Group data items by city block
  const cityGroups: CityGroup[] = [];
  let currentGroup: CityGroup | null = null;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item) continue;

    if (i === 0 || item.cityName !== data[i - 1]?.cityName) {
      currentGroup = { cityName: item.cityName, startIndex: i, items: [] };
      cityGroups.push(currentGroup);
    }
    currentGroup?.items.push({ item, index: i });
  }

  return (
    <div className="lane time-axis" style={{ height: 'var(--lane-height-basic)' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        {/* Darker localized overlay for the header night periods */}
        {data.nightBands &&
          data.nightBands.map((band, idx) => {
            const leftPx = layout.getTimePosition(band.left);
            const rightPx = layout.getTimePosition(band.right);
            return (
              <div
                key={`header-night-${idx}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${leftPx}px`,
                  width: `${rightPx - leftPx}px`,
                  height: '100%',
                  backgroundColor: 'var(--cell-night)',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            );
          })}

        {/* City blocks - each wraps its cells so the label can be CSS sticky */}
        {cityGroups.map((group) => {
          // Sub-group by date within each city
          const dayGroups: DayGroup[] = [];
          let currentDay: DayGroup | null = null;
          for (const { item, index } of group.items) {
            const dateKey = item.time.slice(0, 10);
            if (!currentDay || currentDay.dateKey !== dateKey) {
              currentDay = {
                dateKey,
                dateStr: formatDateLabel(dateKey),
                items: [],
                startIndex: index,
                moonPhase: item.moonPhase,
                moonFraction: item.moonFraction,
              };
              if (currentDay) dayGroups.push(currentDay);
            }
            currentDay?.items.push({ item, index });
          }

          return (
            <div
              key={`block-${group.startIndex}`}
              style={{ display: 'flex', position: 'relative' }}
            >
              {/* Sticky day label overlays */}
              {dayGroups.map((day) => (
                <div
                  key={`daylabel-${day.startIndex}`}
                  style={{
                    position: 'absolute',
                    left: `${
                      layout.getColumnLeft(day.startIndex) - layout.getColumnLeft(group.startIndex)
                    }px`,
                    width: `${layout.getRangeWidth(
                      day.startIndex,
                      day.startIndex + day.items.length,
                    )}px`,
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <div style={{ position: 'sticky', left: 0, width: 'max-content' }}>
                    <div
                      className="time-day-label"
                      style={{
                        padding: '2px 4px',
                        fontSize: '11px',
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold',
                      }}
                    >
                      {day.dateStr}
                    </div>
                  </div>
                  {day.moonPhase != null && day.moonFraction != null && (
                    <div
                      className="time-moon-phase"
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: '4px',
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getMoonPhaseName(day.moonPhase)} {Math.round(day.moonFraction * 100)}%
                    </div>
                  )}
                </div>
              ))}

              {/* Lane cells for this city */}
              {group.items.map(({ item, index }) => {
                return (
                  <div
                    key={index}
                    className="lane-cell"
                    style={{
                      width: `${layout.getColumnWidth(index)}px`,
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      paddingBottom: '4px',
                      zIndex: 5,
                    }}
                  >
                    <div
                      className="time-hour-label"
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        left: index === 0 ? '2px' : 0,
                        transform: index === 0 ? undefined : 'translateX(-50%)',
                        fontSize: '12px',
                        color: 'var(--text-subtle)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shouldShowHourLabel(item.hour, index) ? item.hour : ''}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: `${hourGridTop}px`,
                        bottom: 0,
                        width: '1px',
                        backgroundColor: shouldShowGridLine(item.hour, index)
                          ? 'var(--lane-border)'
                          : 'transparent',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Sun Events Overlay */}
        {data.sunEvents &&
          data.sunEvents.map((ev, i) => {
            if (ev.absoluteIndex == null) return null;
            const exactX = layout.getTimePosition(ev.absoluteIndex);
            if (exactX < 0 || exactX > layout.totalWidth) return null;

            const mm = ev.time.getMinutes().toString().padStart(2, '0');
            const hh = ev.time.getHours().toString().padStart(2, '0');
            const isSunrise = ev.type === 'sunrise';
            const IconComp = isSunrise ? Sunrise : Sunset;
            const color = isSunrise ? 'var(--sunrise-color)' : 'var(--sunset-color)';
            const triggerLabel = isSunrise ? '打开日出方向云况剖面' : '打开日落方向云况剖面';

            const labelEl = (
              <>
                <div
                  className="astro-event-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: eventLabelFontSize,
                    color: color,
                    whiteSpace: 'nowrap',
                    fontWeight: 'bold',
                    WebkitTextStroke: '2px var(--astro-label-stroke)',
                    paintOrder: 'stroke fill',
                  }}
                >
                  <IconComp size={eventIconSize} color={color} /> {hh}:{mm}
                </div>
                <div
                  className="astro-event-stem"
                  style={{
                    height: '6px',
                    width: '1px',
                    backgroundColor: color,
                    marginTop: '2px',
                    opacity: 0.8,
                  }}
                />
              </>
            );

            if (onSelectSunEvent) {
              return (
                <button
                  type="button"
                  key={`sun-${i}`}
                  className="sun-event-trigger"
                  aria-label={triggerLabel}
                  title={triggerLabel}
                  style={{
                    position: 'absolute',
                    left: `${exactX}px`,
                    top: `${sunEventTop}px`,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                    zIndex: 21,
                  }}
                  onClick={() => onSelectSunEvent(ev)}
                >
                  {labelEl}
                </button>
              );
            }

            return (
              <div
                key={`sun-${i}`}
                style={{
                  position: 'absolute',
                  left: `${exactX}px`,
                  top: `${sunEventTop}px`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  zIndex: 21,
                }}
              >
                {labelEl}
              </div>
            );
          })}

        {/* Moon Events Overlay */}
        {data.moonEvents &&
          data.moonEvents.map((ev, i) => {
            if (ev.absoluteIndex == null) return null;
            const exactX = layout.getTimePosition(ev.absoluteIndex);
            if (exactX < 0 || exactX > layout.totalWidth) return null;

            const mm = ev.time.getMinutes().toString().padStart(2, '0');
            const hh = ev.time.getHours().toString().padStart(2, '0');
            const isRise = ev.type === 'moonrise';
            const color = isRise ? 'var(--moonrise-color)' : 'var(--moonset-color)';
            const arrow = isRise ? '↑' : '↓';

            return (
              <div
                key={`moon-${i}`}
                style={{
                  position: 'absolute',
                  left: `${exactX}px`,
                  top: `${moonEventTop}px`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                <div
                  className="moon-event-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: eventLabelFontSize,
                    color: color,
                    whiteSpace: 'nowrap',
                    fontWeight: 'bold',
                    WebkitTextStroke: '2px var(--astro-label-stroke)',
                    paintOrder: 'stroke fill',
                  }}
                >
                  <Moon size={eventIconSize} color={color} />
                  {arrow}
                  {hh}:{mm}
                </div>
                <div
                  className="moon-event-stem"
                  style={{
                    height: '18px',
                    width: '1px',
                    backgroundColor: color,
                    marginTop: '2px',
                    opacity: 0.8,
                  }}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}
