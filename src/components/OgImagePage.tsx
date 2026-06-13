import { useCallback, useMemo, useState } from 'react';
import DashboardCaptureRender from './DashboardCaptureRender';
import { calculateDashboardScales } from '../services/weatherMetrics';
import {
  captureLocationLabel,
  captureRangeLabel,
  sliceTimelineForCapture,
  type CaptureSelection,
} from '../services/timelineCapture';
import type { CanvasCaptureStatus } from '../hooks/canvasCaptureContext';
import type { WeatherTimeline } from '../types/weather';
import './Dashboard.css';
import './OgImagePage.css';

interface OgImagePageProps {
  data: WeatherTimeline;
  hours: number;
}

export default function OgImagePage({ data, hours }: OgImagePageProps) {
  const [canvasReady, setCanvasReady] = useState(false);

  const selection = useMemo<CaptureSelection>(() => ({
    startIndex: 0,
    endIndex: Math.min(Math.max(1, Math.round(hours)), data.length),
  }), [data.length, hours]);

  const captureData = useMemo(
    () => sliceTimelineForCapture(data, selection),
    [data, selection],
  );
  const scales = useMemo(() => calculateDashboardScales(data), [data]);

  const handleCanvasStatus = useCallback((status: CanvasCaptureStatus) => {
    if (status.total > 0 && status.ready) {
      setCanvasReady(true);
    }
  }, []);

  return (
    <main className="og-image-page" data-og-ready={canvasReady || undefined}>
      <section className="og-image-canvas" aria-label="Weather Dashboard social preview">
        <div className="og-grid" aria-hidden="true" />
        <div className="og-copy">
          <div className="og-kicker">Route weather intelligence</div>
          <h1>Weather Dashboard</h1>
          <p>Hourly forecast lanes for trips, cloud layers, precipitation, wind, air quality, and sounding detail.</p>

          <div className="og-meta">
            <span>{captureLocationLabel(captureData)}</span>
            <span>{captureRangeLabel(captureData)}</span>
          </div>
        </div>

        <div className="og-dashboard-window" aria-label="Dashboard preview">
          <div className="og-dashboard-stage">
            <DashboardCaptureRender
              data={data}
              selection={selection}
              compactMode={false}
              scales={scales}
              switchInfo={{}}
              onCanvasStatusChange={handleCanvasStatus}
            />
          </div>
        </div>

        <div className="og-repo-mark">github.com/Enter-tainer/weather-dashboard</div>
      </section>
    </main>
  );
}
