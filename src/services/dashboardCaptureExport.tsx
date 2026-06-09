import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import DashboardCaptureRender from '../components/DashboardCaptureRender';
import type { CanvasCaptureStatus } from '../hooks/canvasCaptureContext';
import type { SwitchInfo } from '../hooks/useDashboardData';
import { captureFileName, type CaptureSelection } from './timelineCapture';
import type { DashboardScales, WeatherTimeline } from '../types/weather';

interface ExportDashboardCaptureOptions {
  data: WeatherTimeline;
  selection: CaptureSelection;
  compactMode: boolean;
  scales: DashboardScales;
  switchInfo: SwitchInfo;
}

const CANVAS_READY_TIMEOUT_MS = 1200;
const CANVAS_STABLE_MS = 60;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function waitForCanvasReady(getStatus: () => CanvasCaptureStatus, getLastChange: () => number): Promise<void> {
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
  scales,
  switchInfo,
}: ExportDashboardCaptureOptions): Promise<void> {
  const host = document.createElement('div');
  host.className = 'dashboard-capture-host';
  document.body.appendChild(host);

  let canvasStatus: CanvasCaptureStatus = { total: 0, drawn: 0, ready: false };
  let lastCanvasStatusChange = Date.now();

  const root = createRoot(host);
  root.render(
    <DashboardCaptureRender
      data={data}
      selection={selection}
      compactMode={compactMode}
      scales={scales}
      switchInfo={switchInfo}
      onCanvasStatusChange={(status) => {
        canvasStatus = status;
        lastCanvasStatusChange = Date.now();
      }}
    />,
  );

  try {
    await nextFrame();
    await nextFrame();
    await waitForCanvasReady(() => canvasStatus, () => lastCanvasStatusChange);
    await nextFrame();

    const captureNode = host.querySelector<HTMLElement>('.dashboard-capture-sheet');
    if (!captureNode) {
      throw new Error('Capture render node was not mounted');
    }

    const rect = captureNode.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const dataUrl = await toPng(captureNode, {
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

    downloadDataUrl(dataUrl, captureFileName(data, selection));
  } finally {
    root.unmount();
    host.remove();
  }
}
