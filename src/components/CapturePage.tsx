import { useCallback, useMemo, useState } from 'react';
import DashboardCaptureRender from './DashboardCaptureRender';
import { calculateDashboardScales } from '../services/weatherMetrics';
import type { CanvasCaptureStatus } from '../hooks/canvasCaptureContext';
import type { WeatherTimeline } from '../types/weather';

interface CapturePageProps {
  data: WeatherTimeline;
  hours: number;
}

export default function CapturePage({ data, hours }: CapturePageProps) {
  const [canvasReady, setCanvasReady] = useState(false);

  const selection = useMemo(() => ({
    startIndex: 0,
    endIndex: Math.min(hours, data.length),
  }), [hours, data.length]);

  const scales = useMemo(() => calculateDashboardScales(data), [data]);

  const handleCanvasStatus = useCallback((status: CanvasCaptureStatus) => {
    if (status.total > 0 && status.ready) {
      setCanvasReady(true);
    }
  }, []);

  return (
    <div data-capture-ready={canvasReady || undefined}>
      <DashboardCaptureRender
        data={data}
        selection={selection}
        compactMode={false}
        scales={scales}
        switchInfo={{}}
        onCanvasStatusChange={handleCanvasStatus}
      />
    </div>
  );
}
