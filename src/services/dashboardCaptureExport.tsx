import { createRoot } from 'react-dom/client';
import { toCanvas } from 'html-to-image';
import DashboardCaptureRender from '../components/DashboardCaptureRender';
import type { CanvasCaptureStatus } from '../hooks/canvasCaptureContext';
import type { SwitchInfo } from '../hooks/useDashboardData';
import type { MinutelyPrecipitationSelection } from '../hooks/useMinutelyPrecipitation';
import { captureFileName, type CaptureSelection } from './timelineCapture';
import type { DashboardScales, WeatherTimeline } from '../types/weather';
import RenderProfileProvider from '../hooks/RenderProfileProvider';
import type { DisplayMode } from '../hooks/useDisplayMode';

interface ExportDashboardCaptureOptions {
  data: WeatherTimeline;
  selection: CaptureSelection;
  compactMode: boolean;
  hoursPerColumn?: number;
  scales: DashboardScales;
  switchInfo: SwitchInfo;
  minutelySelection?: MinutelyPrecipitationSelection | null;
}

const CANVAS_READY_TIMEOUT_MS = 1200;
const CANVAS_STABLE_MS = 60;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function waitForCanvasReady(
  getStatus: () => CanvasCaptureStatus,
  getLastChange: () => number,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CANVAS_READY_TIMEOUT_MS) {
    const status = getStatus();
    const stableFor = Date.now() - getLastChange();
    if (status.total > 0 && status.ready && stableFor >= CANVAS_STABLE_MS) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }
}

export async function exportDashboardCapture({
  data,
  selection,
  compactMode,
  hoursPerColumn = 1,
  scales,
  switchInfo,
  minutelySelection = null,
}: ExportDashboardCaptureOptions): Promise<void> {
  const host = document.createElement('div');
  host.className = 'dashboard-capture-host';
  document.body.appendChild(host);

  let canvasStatus: CanvasCaptureStatus = { total: 0, drawn: 0, ready: false };
  let lastCanvasStatusChange = Date.now();

  const root = createRoot(host);
  const displayMode: DisplayMode =
    document.documentElement.dataset.display === 'eink' ? 'eink' : 'color';
  root.render(
    <RenderProfileProvider displayMode={displayMode}>
      <DashboardCaptureRender
        data={data}
        selection={selection}
        compactMode={compactMode}
        hoursPerColumn={hoursPerColumn}
        scales={scales}
        switchInfo={switchInfo}
        minutelySelection={minutelySelection}
        onCanvasStatusChange={(status) => {
          canvasStatus = status;
          lastCanvasStatusChange = Date.now();
        }}
      />
    </RenderProfileProvider>,
  );

  try {
    await nextFrame();
    await nextFrame();
    await waitForCanvasReady(
      () => canvasStatus,
      () => lastCanvasStatusChange,
    );
    await nextFrame();

    const captureNode = host.querySelector<HTMLElement>('.dashboard-capture-sheet');
    if (!captureNode) {
      throw new Error('Capture render node was not mounted');
    }

    const rect = captureNode.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const canvas = await toCanvas(captureNode, {
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      backgroundColor: window.getComputedStyle(captureNode).backgroundColor,
      style: {
        margin: '0',
        padding: '0',
        border: '0',
        transform: 'none',
      },
      pixelRatio: window.devicePixelRatio || 2,
      cacheBust: true,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('WebP encoding failed'));
        },
        'image/webp',
        0.85,
      );
    });

    downloadBlob(blob, captureFileName(data, selection));
  } finally {
    root.unmount();
    host.remove();
  }
}
