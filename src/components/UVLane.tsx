import { useMemo } from 'react';
import type { WeatherPoint } from '../types/weather';
import './Dashboard.css';

interface UvRun {
  rounded: number | null;
  start: number;
  length: number;
}

interface UVLaneProps {
  data: WeatherPoint[];
}

function getUvColor(uv: number): string {
  if (uv <= 2) return '#8bc34a'; // Green (Low)
  if (uv <= 5) return '#ffeb3b'; // Yellow (Mod)
  if (uv <= 7) return '#fb8c00'; // Orange (High)
  if (uv <= 10) return '#e53935'; // Red (Very High)
  return '#8e24aa'; // Purple (Extreme)
}

function computeUvRuns(data: WeatherPoint[]): UvRun[] {
  const runs: UvRun[] = [];
  let i = 0;
  while (i < data.length) {
    const item = data[i];
    if (!item) break;
    const rounded = item.uvIndex == null ? null : Math.round(item.uvIndex);
    const start = i;
    while (i < data.length) {
      const currentUv = data[i]?.uvIndex;
      const currentRounded = currentUv == null ? null : Math.round(currentUv);
      if (currentRounded !== rounded) break;
      i++;
    }
    runs.push({ rounded, start, length: i - start });
  }
  return runs;
}

export default function UVLane({ data }: UVLaneProps) {
  const runs = useMemo(() => computeUvRuns(data), [data]);

  return (
    <div
      className="lane uv-lane"
      style={{ height: 'var(--lane-height-uv)', backgroundColor: 'transparent' }}
    >
      <div className="lane-data" style={{ position: 'relative' }}>
        {/* Base cells to keep grid columns */}
        {data.map((item, index) => (
          <div key={index} className="lane-cell" />
        ))}

        {/* Overlay: one badge centered over each merged run */}
        {runs.map((run, runIdx) => {
          const rounded = run.rounded;
          const showText = rounded != null && rounded > 0;
          const leftPx = `calc(${run.start} * var(--col-width-hour))`;
          const widthPx = `calc(${run.length} * var(--col-width-hour))`;

          return (
            <div
              key={`uv-run-${runIdx}`}
              style={{
                position: 'absolute',
                left: leftPx,
                width: widthPx,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              {showText && rounded != null && (
                <span
                  style={{
                    fontSize: '10px',
                    color: rounded <= 5 ? '#1d251f' : '#fff',
                    backgroundColor: getUvColor(rounded),
                    padding: '0 4px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  }}
                >
                  {rounded}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
