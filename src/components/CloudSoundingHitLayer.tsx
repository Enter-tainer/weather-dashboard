import type { WeatherPoint } from '../types/weather';
import { DEFAULT_HOUR_WIDTH, getTimelineWidth } from '../services/timelineLayout';

interface CloudSoundingHitLayerProps {
  data: WeatherPoint[];
  activeTime: string | null;
  onSelect?: (item: WeatherPoint) => void;
  bottomOffset?: number;
  hourWidth?: number;
}

function formatHour(item: WeatherPoint): string {
  return new Date(item.time).getHours().toString().padStart(2, '0');
}

export default function CloudSoundingHitLayer({
  data,
  activeTime,
  onSelect,
  bottomOffset = 0,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: CloudSoundingHitLayerProps) {
  if (typeof onSelect !== 'function') return null;

  return (
    <div
      className="cloud-sounding-hit-layer"
      style={{
        width: `${getTimelineWidth(data.length, hourWidth)}px`,
        bottom: bottomOffset ? `${bottomOffset}px` : 0,
      }}
      aria-label="Skew-T 探空图时次"
    >
      {data.map((item, index) => (
        <button
          key={`cloud-sounding-hit-${index}`}
          type="button"
          className={['cloud-sounding-hit-cell', item.time === activeTime ? 'is-active' : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect(item)}
          title={`${item.cityName} ${formatHour(item)}:00 Skew-T`}
          aria-label={`打开 ${item.cityName} ${formatHour(item)}:00 的 Skew-T`}
        />
      ))}
    </div>
  );
}
