import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import {
  DEFAULT_HOUR_WIDTH,
  getHourCenter,
  getHourLeft,
  getTimelineWidth,
} from '../services/timelineLayout';
import { getBeaufort } from '../services/weatherMetrics';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

const LANE_HEIGHT = 80;
const COMPACT_LANE_HEIGHT = 36;

interface WindLaneProps {
  data: WeatherPoint[];
  maxBft: number;
  compact?: boolean;
  hourWidth?: number;
}

export default function WindLane({
  data,
  maxBft,
  compact = false,
  hourWidth = DEFAULT_HOUR_WIDTH,
}: WindLaneProps) {
  const width = getTimelineWidth(data.length, hourWidth);
  const barWidth = Math.max(2, Math.min(8, hourWidth * 0.7));
  const compactLabelInterval = hourWidth < 12 ? 3 : 1;
  const fullLabelInterval = hourWidth < 12 ? 6 : 3;

  const canvasRef = useCanvas(
    width,
    LANE_HEIGHT,
    (ctx) => {
      const windMemberFill = cssVar('--wind-member-fill', 'rgba(0, 150, 136, 0.04)');
      const windMainFill = cssVar('--wind-main-fill', 'rgba(0, 137, 123, 0.5)');
      const gustColor = cssVar('--danger', '#d32f2f');

      data.forEach((d, i) => {
        const x = getHourLeft(i, hourWidth);
        const cx = getHourCenter(i, hourWidth);
        // Chart available height: 45px (bottom 30px max reserved for arrow area, 5px top padding)
        const drawHeight = 45;

        // Draw ensemble wind bars (faint)
        if (d.windMembers && d.windMembers.length > 0) {
          ctx.fillStyle = windMemberFill;
          d.windMembers.forEach((w) => {
            const bw = getBeaufort(w);
            const h = (bw / maxBft) * drawHeight;
            if (h > 0) ctx.fillRect(x, LANE_HEIGHT - 30 - h, hourWidth, h);
          });
        }

        // Draw main deterministic wind bar
        const bSpeed = getBeaufort(d.windSpeed);
        const mainH = (bSpeed / maxBft) * drawHeight;
        ctx.fillStyle = windMainFill;
        if (mainH > 0) ctx.fillRect(cx - barWidth / 2, LANE_HEIGHT - 30 - mainH, barWidth, mainH);

        // Draw gust alert dot
        const bGusts = getBeaufort(d.windGusts);
        if (bGusts > bSpeed) {
          const gustH = (bGusts / maxBft) * drawHeight;
          ctx.fillStyle = gustColor;
          ctx.beginPath();
          ctx.arc(cx, LANE_HEIGHT - 30 - gustH, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },
    [data, maxBft, hourWidth, barWidth],
  );

  if (compact) {
    return (
      <div
        className="lane wind-lane"
        style={{
          height: `${COMPACT_LANE_HEIGHT}px`,
          position: 'relative',
          borderBottom: '1px solid var(--lane-border)',
        }}
      >
        <div className="lane-data">
          {data.map((item, index) => {
            const bft = getBeaufort(item.windSpeed);
            return (
              <div
                key={index}
                className="lane-cell"
                style={{
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '1px',
                }}
              >
                {index % compactLabelInterval === 0 && (
                  <>
                    <span
                      style={{
                        fontSize: hourWidth < 12 ? '9px' : '11px',
                        lineHeight: 1,
                        color: bft >= 6 ? 'var(--danger)' : 'var(--metric-text-strong)',
                        fontWeight: bft >= 4 ? 'bold' : 600,
                      }}
                    >
                      {item.windSpeed == null ? '—' : bft}
                    </span>
                    {hourWidth >= 12 && item.windDir != null && (
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        style={{
                          transform: `rotate(${item.windDir + 180}deg)`,
                          color: bft >= 6 ? 'var(--danger)' : 'var(--text-light)',
                          opacity: 0.86,
                        }}
                      >
                        <path
                          d="M12 2L12 22M12 2L6 8M12 2L18 8"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="lane wind-lane"
      style={{
        height: `${LANE_HEIGHT}px`,
        position: 'relative',
        borderBottom: '1px solid var(--lane-border)',
      }}
    >
      <div className="lane-data">
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${LANE_HEIGHT}px`,
            zIndex: 1,
          }}
        />

        {/* Overlay text and arrows */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${LANE_HEIGHT}px`,
            display: 'flex',
            zIndex: 2,
          }}
        >
          {data.map((item, index) => (
            <div
              key={index}
              className="lane-cell"
              style={{
                flexDirection: 'column',
                justifyContent: 'flex-end',
                paddingBottom: '3px',
                alignItems: 'center',
              }}
            >
              {index % fullLabelInterval === 0 && (
                <>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--metric-text-strong)',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.windSpeed == null ? '—' : getBeaufort(item.windSpeed)}
                  </span>
                  {item.windDir != null && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      style={{
                        transform: `rotate(${item.windDir + 180}deg)`,
                        color: 'var(--text-light)',
                        opacity: 0.86,
                        marginTop: '1px',
                      }}
                    >
                      <path
                        d="M12 2L12 22M12 2L6 8M12 2L18 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
