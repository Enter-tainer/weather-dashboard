import { useCanvas } from '../hooks/useCanvas';
import { cssVar } from '../services/themeColors';
import { DEFAULT_HOUR_WIDTH } from '../services/timelineLayout';
import { useTimelineLayout } from '../hooks/useTimelineLayout';
import { getBeaufort } from '../services/weatherMetrics';
import type { WeatherPoint } from '../types/weather';
import { useIsEink } from '../hooks/useRenderProfile';
import { getMonoPattern } from '../services/monoPatterns';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import './Dashboard.css';

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
  const isEink = useIsEink();
  const dashboardLayout = useDashboardLayout();
  const laneHeight = dashboardLayout.windHeight;
  const bottomAreaHeight = dashboardLayout.windBottomAreaHeight;
  const drawHeight = Math.max(1, laneHeight - bottomAreaHeight - 5);
  const layout = useTimelineLayout(data.length, hourWidth);
  const width = layout.totalWidth;
  const barWidth = Math.max(2, Math.min(8, hourWidth * 0.7));
  const compactLabelInterval = hourWidth < 12 ? 3 : 1;
  const fullLabelInterval = hourWidth < 12 ? 6 : 3;

  const canvasRef = useCanvas(
    width,
    laneHeight,
    (ctx) => {
      const windMemberFill = isEink
        ? getMonoPattern(ctx, 'dots-1')
        : cssVar('--wind-member-fill', 'rgba(0, 150, 136, 0.04)');
      const windMainFill = isEink
        ? '#000000'
        : cssVar('--wind-main-fill', 'rgba(0, 137, 123, 0.5)');
      const gustColor = isEink ? '#000000' : cssVar('--danger', '#d32f2f');

      data.forEach((d, i) => {
        const x = layout.getColumnLeft(i);
        const cx = layout.getColumnCenter(i);
        const columnWidth = layout.getColumnWidth(i);
        // Draw ensemble wind bars (faint)
        if (d.windMembers && d.windMembers.length > 0) {
          ctx.fillStyle = windMemberFill;
          d.windMembers.forEach((w) => {
            const bw = getBeaufort(w);
            const h = (bw / maxBft) * drawHeight;
            if (h > 0) ctx.fillRect(x, laneHeight - bottomAreaHeight - h, columnWidth, h);
          });
        }

        // Draw main deterministic wind bar
        const bSpeed = getBeaufort(d.windSpeed);
        const mainH = (bSpeed / maxBft) * drawHeight;
        ctx.fillStyle = windMainFill;
        if (mainH > 0)
          ctx.fillRect(cx - barWidth / 2, laneHeight - bottomAreaHeight - mainH, barWidth, mainH);

        // Draw gust alert dot
        const bGusts = getBeaufort(d.windGusts);
        if (bGusts > bSpeed) {
          const gustH = (bGusts / maxBft) * drawHeight;
          ctx.fillStyle = gustColor;
          ctx.beginPath();
          ctx.arc(cx, laneHeight - bottomAreaHeight - gustH, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    },
    [data, maxBft, layout, barWidth, isEink, laneHeight, bottomAreaHeight, drawHeight],
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
                  width: `${layout.getColumnWidth(index)}px`,
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '1px',
                }}
              >
                {(layout.isExpandedColumn(index) || index % compactLabelInterval === 0) && (
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
        height: `${laneHeight}px`,
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
            height: `${laneHeight}px`,
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
            height: `${laneHeight}px`,
            display: 'flex',
            zIndex: 2,
          }}
        >
          {data.map((item, index) => (
            <div
              key={index}
              className="lane-cell"
              style={{
                width: `${layout.getColumnWidth(index)}px`,
                flexDirection: 'column',
                justifyContent: 'flex-end',
                paddingBottom: '3px',
                alignItems: 'center',
              }}
            >
              {(layout.isExpandedColumn(index) || index % fullLabelInterval === 0) && (
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
