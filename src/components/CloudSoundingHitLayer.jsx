const COL_WIDTH = 22;

function formatHour(item) {
  return new Date(item.time).getHours().toString().padStart(2, '0');
}

export default function CloudSoundingHitLayer({
  data,
  activeIndex,
  onSelect,
  bottomOffset = 0,
}) {
  if (typeof onSelect !== 'function') return null;

  return (
    <div
      className="cloud-sounding-hit-layer"
      style={{
        width: `${data.length * COL_WIDTH}px`,
        bottom: bottomOffset ? `${bottomOffset}px` : 0,
      }}
      aria-label="Skew-T 探空图时次"
    >
      {data.map((item, index) => (
        <button
          key={`cloud-sounding-hit-${index}`}
          type="button"
          className={[
            'cloud-sounding-hit-cell',
            index === activeIndex ? 'is-active' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => onSelect(index)}
          title={`${item.cityName} ${formatHour(item)}:00 Skew-T`}
          aria-label={`打开 ${item.cityName} ${formatHour(item)}:00 的 Skew-T`}
        />
      ))}
    </div>
  );
}
