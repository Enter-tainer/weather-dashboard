import { useMemo } from 'react';
import DashboardLegend from './DashboardLegend';
import { DashboardLaneStack } from './DashboardLanes';
import { CanvasCaptureProvider } from '../hooks/canvasCapture';
import type { CanvasCaptureStatus } from '../hooks/canvasCaptureContext';
import type { SwitchInfo } from '../hooks/useDashboardData';
import {
  CAPTURE_COL_WIDTH,
  captureLocationLabel,
  captureRangeLabel,
  sliceTimelineForCapture,
  type CaptureSelection,
} from '../services/timelineCapture';
import type { DashboardScales, WeatherTimeline } from '../types/weather';

const CAPTURE_LEGEND_WIDTH = 48;

interface DashboardCaptureRenderProps {
  data: WeatherTimeline;
  selection: CaptureSelection;
  compactMode: boolean;
  scales: DashboardScales;
  switchInfo: SwitchInfo;
  onCanvasStatusChange?: ((status: CanvasCaptureStatus) => void) | undefined;
}

export default function DashboardCaptureRender({
  data,
  selection,
  compactMode,
  scales,
  switchInfo,
  onCanvasStatusChange,
}: DashboardCaptureRenderProps) {
  const captureData = useMemo(
    () => sliceTimelineForCapture(data, selection),
    [data, selection],
  );
  const width = CAPTURE_LEGEND_WIDTH + captureData.length * CAPTURE_COL_WIDTH;

  return (
    <CanvasCaptureProvider onStatusChange={onCanvasStatusChange}>
      <div
        className="dashboard-capture-sheet"
        style={{ width: `${width}px` }}
        aria-label="天气截图"
      >
        <div className="dashboard-capture-header">
          <div className="dashboard-capture-location">{captureLocationLabel(captureData)}</div>
          <div className="dashboard-capture-range">{captureRangeLabel(captureData)}</div>
        </div>
        <div className="dashboard-capture-body">
          <DashboardLegend compactMode={compactMode} scales={scales} showGitHubLink={false} />
          <DashboardLaneStack
            data={captureData}
            compactMode={compactMode}
            scales={scales}
            switchInfo={switchInfo}
            renderMode="capture"
          />
        </div>
      </div>
    </CanvasCaptureProvider>
  );
}
