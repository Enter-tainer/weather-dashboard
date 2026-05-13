import './Dashboard.css';

// Gradient from light blue (low prob) to dark blue (high prob)
function probColor(prob) {
  if (prob >= 80) return '#01579b';
  if (prob >= 60) return '#0277bd';
  if (prob >= 40) return '#0288d1';
  if (prob >= 20) return '#039be5';
  return '#4fc3f7';
}

function precipColor(code, alpha = 0.6) {
  if ([95, 96, 99].includes(code)) return `rgba(107, 33, 168, ${alpha})`;
  if ([56, 57, 66, 67].includes(code)) return `rgba(139, 92, 246, ${alpha})`;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return `rgba(56, 189, 248, ${alpha})`;
  if ([51, 53, 55].includes(code)) return `rgba(96, 165, 250, ${alpha})`;
  return `rgba(13, 71, 161, ${alpha})`;
}

function formatPrecip(value) {
  if (value >= 10) return Math.round(value);
  if (value >= 1) return value.toFixed(1);
  if (value >= 0.1) return value.toFixed(1);
  return '';
}

export default function PrecipitationProbLane({ data, compact = false }) {
  return (
    <div className="lane precip-prob-lane" style={{ height: compact ? '42px' : 'var(--lane-height-precip-prob)', backgroundColor: 'transparent' }}>
      <div className="lane-data">
        {data.map((item, index) => {
           const prob = item.precipitationProb;
           const text = prob >= 5 ? `${prob}` : '';
           const precipText = compact ? formatPrecip(item.precipitation) : '';
           const barHeight = compact && item.precipitation > 0 ? Math.min(18, item.precipitation * 2.2) : 0;
           const showPrecipText = precipText && (index % 3 === 0 || item.precipitation >= 1.5);

           return (
             <div key={index} className="lane-cell" style={{ flexDirection: 'column', justifyContent: compact ? 'flex-start' : 'center', padding: compact ? '2px 0 0' : 0 }}>
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
                {!compact && index % 3 === 0 && text && (
                   <span style={{ fontSize: '10px', lineHeight: 1, color: probColor(prob), fontWeight: 'bold', zIndex: 1 }}>{text}%</span>
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
                      WebkitTextStroke: '2px rgba(255,255,255,0.9)',
                      paintOrder: 'stroke fill',
                      zIndex: 1,
                    }}
                  >
                    {precipText}
                  </span>
                )}
                {compact && index % 3 === 0 && text && (
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
      </div>
    </div>
  );
}
