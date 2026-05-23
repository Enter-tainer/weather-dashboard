import { useState, useEffect, useRef } from 'react';

const COL_WIDTH = 22;
const LEGEND_WIDTH = 48; // var(--legend-width)

/**
 * Parse a "YYYY-MM-DDTHH:MM" timestamp as local-time epoch (ms).
 *
 * Avoids new Date(string) which has inconsistent behaviour across JS
 * engines — some treat no-timezone ISO-ish strings as UTC, others as
 * local time.  Explicit component construction guarantees local-time
 * interpretation everywhere, matching the browser's timezone.
 */
function parseLocalTime(timeStr) {
  const [datePart, timePart] = timeStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

/**
 * Current wall-clock time as local-time epoch, built from explicit
 * components so the tick value and data timestamps share the same
 * timezone interpretation.
 */
function getLocalNowMs() {
  const now = new Date();
  return new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes(), 0, 0
  ).getTime();
}

/**
 * Renders a vertical "now" indicator line on the weather dashboard timeline.
 * Finds the current time's position in the data array and draws a vertical
 * dashed line that spans all lanes.
 *
 * - Only shows when the current time falls within the data time range.
 * - Updates position every 60 seconds.
 * - Interpolates between hourly data points for smooth positioning.
 */
export default function NowIndicator({ data }) {
  const [nowTimestamp, setNowTimestamp] = useState(() => getLocalNowMs());
  const nowRef = useRef(nowTimestamp);
  nowRef.current = nowTimestamp;

  // Tick every 60 seconds so the line moves as time passes
  useEffect(() => {
    const timer = setInterval(() => {
      const t = getLocalNowMs();
      if (t !== nowRef.current) setNowTimestamp(t);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!data || data.length < 2) return null;

  // Find which two data items bracket the current time.
  // Returns the left position in pixels (including legend offset).
  let positionPx = null;

  for (let i = 0; i < data.length; i++) {
    const itemTimeMs = parseLocalTime(data[i].time);

    // Before the first data point — hide
    if (i === 0 && nowTimestamp < itemTimeMs) break;

    // Between item[i] and item[i+1]
    if (i < data.length - 1) {
      const nextTimeMs = parseLocalTime(data[i + 1].time);
      if (nowTimestamp >= itemTimeMs && nowTimestamp < nextTimeMs) {
        const intervalMs = nextTimeMs - itemTimeMs;
        const fraction = intervalMs > 0 ? (nowTimestamp - itemTimeMs) / intervalMs : 0;
        positionPx = LEGEND_WIDTH + (i + 0.5 + fraction) * COL_WIDTH;
        break;
      }
    } else {
      // Last item: extend 1 hour past it (typical hourly data)
      const oneHourMs = 3600000;
      if (nowTimestamp >= itemTimeMs && nowTimestamp < itemTimeMs + oneHourMs) {
        const fraction = (nowTimestamp - itemTimeMs) / oneHourMs;
        positionPx = LEGEND_WIDTH + (i + 0.5 + fraction) * COL_WIDTH;
        break;
      }
    }
  }

  if (positionPx === null) return null;

  return (
    <>
      {/* Vertical dashed line spanning all lanes */}
      <div
        className="now-indicator-line"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${positionPx}px`,
          width: 0,
          borderLeft: '1px dashed rgba(190, 45, 35, 0.25)',
          zIndex: 100,
          pointerEvents: 'none',
        }}
      />
      {/* Subtle label badge at the top */}
      <div
        className="now-indicator-label"
        style={{
          position: 'absolute',
          top: '4px',
          left: `${positionPx}px`,
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(190, 45, 35, 0.55)',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: '9px',
          fontWeight: 500,
          padding: '1px 4px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 101,
          lineHeight: '16px',
        }}
      >
        现在
      </div>
    </>
  );
}
