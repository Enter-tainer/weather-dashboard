import { useMemo } from 'react';
import DashboardLegend from './DashboardLegend';
import { DashboardLaneStack } from './DashboardLanes';
import { CanvasCaptureProvider } from '../hooks/canvasCapture';
import type { CanvasCaptureStatus } from '../hooks/canvasCaptureContext';
import type { SwitchInfo } from '../hooks/useDashboardData';
import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import {
  captureLocationLabel,
  captureRangeLabel,
  normalizeCaptureSelection,
  sliceTimelineForCapture,
  type CaptureSelection,
} from '../services/timelineCapture';
import {
  createTimelineLayout,
  EXPANDED_MINUTELY_WIDTH,
  MINUTELY_EXPANDED_SPAN,
  getTimelineHourWidth,
} from '../services/timelineLayout';
import type { DashboardScales, WeatherTimeline } from '../types/weather';

const CAPTURE_LEGEND_WIDTH = 48;

interface DashboardCaptureRenderProps {
  data: WeatherTimeline;
  selection: CaptureSelection;
  compactMode: boolean;
  hoursPerColumn?: number;
  scales: DashboardScales;
  switchInfo: SwitchInfo;
  minutelySelection?: MinutelyPrecipitationSelection | null;
  onCanvasStatusChange?: ((status: CanvasCaptureStatus) => void) | undefined;
}

export default function DashboardCaptureRender({
  data,
  selection,
  compactMode,
  hoursPerColumn = 1,
  scales,
  switchInfo,
  minutelySelection = null,
  onCanvasStatusChange,
}: DashboardCaptureRenderProps) {
  const normalizedSelection = useMemo(
    () => normalizeCaptureSelection(selection, data.length),
    [data.length, selection],
  );
  const captureData = useMemo(
    () => sliceTimelineForCapture(data, normalizedSelection),
    [data, normalizedSelection],
  );
  const hourWidth = getTimelineHourWidth();
  const captureMinutelySelection = useMemo(() => {
    if (
      !minutelySelection ||
      minutelySelection.index < normalizedSelection.startIndex ||
      minutelySelection.index + MINUTELY_EXPANDED_SPAN > normalizedSelection.endIndex
    ) {
      return null;
    }

    const localIndex = minutelySelection.index - normalizedSelection.startIndex;
    const localItem = captureData[localIndex];
    return localItem ? { ...minutelySelection, index: localIndex, item: localItem } : null;
  }, [captureData, minutelySelection, normalizedSelection]);
  const captureLayout = useMemo(
    () =>
      createTimelineLayout(
        captureData.length,
        hourWidth,
        captureMinutelySelection?.index ?? null,
        EXPANDED_MINUTELY_WIDTH,
        MINUTELY_EXPANDED_SPAN,
      ),
    [captureData.length, captureMinutelySelection?.index, hourWidth],
  );
  const width = CAPTURE_LEGEND_WIDTH + captureLayout.totalWidth;

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
            hoursPerColumn={hoursPerColumn}
            scales={scales}
            switchInfo={switchInfo}
            renderMode="capture"
            minutelySelection={captureMinutelySelection}
          />
        </div>
      </div>
    </CanvasCaptureProvider>
  );
}
