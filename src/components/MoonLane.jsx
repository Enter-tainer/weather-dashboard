import './Dashboard.css';

const COL_WIDTH = 22;

// Moon phase emoji based on phase value (0-1)
function getMoonEmoji(phase) {
  if (phase < 0.0625) return '🌑';      // new moon
  if (phase < 0.1875) return '🌒';      // waxing crescent
  if (phase < 0.3125) return '🌓';      // first quarter
  if (phase < 0.4375) return '🌔';      // waxing gibbous
  if (phase < 0.5625) return '🌕';      // full moon
  if (phase < 0.6875) return '🌖';      // waning gibbous
  if (phase < 0.8125) return '🌗';      // last quarter
  if (phase < 0.9375) return '🌘';      // waning crescent
  return '🌑';                           // new moon
}

function getMoonPhaseName(phase) {
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

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function MoonLane({ data }) {
  if (!data || data.length === 0) return null;

  const moonEvents = data.moonEvents || [];

  return (
    <div className="lane moon-lane" style={{ height: '28px', position: 'relative' }}>
      <div className="lane-data" style={{ position: 'relative' }}>
        {/* Moon phase shown every 24 hours */}
        {data.map((item, index) => {
          // Show moon phase at hour 0 or every 24 cells
          const showPhase = item.hour === 0 || index === 0;
          return (
            <div key={index} className="lane-cell" style={{ fontSize: '10px', position: 'relative' }}>
              {showPhase && item.moonPhase != null && (
                <span title={`${getMoonPhaseName(item.moonPhase)} ${Math.round(item.moonFraction * 100)}%`} style={{ fontSize: '14px', lineHeight: 1 }}>
                  {getMoonEmoji(item.moonPhase)}
                </span>
              )}
            </div>
          );
        })}

        {/* Moonrise/moonset event markers */}
        {moonEvents.map((ev, idx) => {
          const leftPx = ev.absoluteIndex * COL_WIDTH + COL_WIDTH / 2;
          const isRise = ev.type === 'moonrise';
          return (
            <div
              key={`moon-${idx}`}
              style={{
                position: 'absolute',
                left: `${leftPx - 14}px`,
                top: '1px',
                fontSize: '8px',
                color: isRise ? '#b8860b' : '#666',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                textAlign: 'center',
                width: '28px',
              }}
            >
              <div style={{ fontSize: '9px' }}>{isRise ? '↑' : '↓'}</div>
              <div>{formatTime(ev.time)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
