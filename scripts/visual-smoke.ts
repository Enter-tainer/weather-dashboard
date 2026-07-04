import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, type Browser, type Locator, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

interface VisualCase {
  name: string;
  path: string;
  viewport: {
    width: number;
    height: number;
  };
  readySelector: string;
  targetSelector: string;
  minWidth: number;
  minHeight: number;
  minBytes: number;
  requireCanvas?: boolean;
}

const CASES: VisualCase[] = [
  {
    name: 'desktop-dark',
    path: '/?fixture=default&theme=dark',
    viewport: { width: 1440, height: 900 },
    readySelector: '.lanes-container',
    targetSelector: '.dashboard-wrapper',
    minWidth: 1000,
    minHeight: 500,
    minBytes: 20_000,
    requireCanvas: true,
  },
  {
    name: 'desktop-light',
    path: '/?fixture=default&theme=light',
    viewport: { width: 1440, height: 900 },
    readySelector: '.lanes-container',
    targetSelector: '.dashboard-wrapper',
    minWidth: 1000,
    minHeight: 500,
    minBytes: 20_000,
    requireCanvas: true,
  },
  {
    name: 'compact',
    path: '/?fixture=default&compact=1&theme=dark',
    viewport: { width: 1440, height: 900 },
    readySelector: '.lanes-container',
    targetSelector: '.dashboard-wrapper',
    minWidth: 1000,
    minHeight: 400,
    minBytes: 15_000,
    requireCanvas: true,
  },
  {
    name: 'time-compact',
    path: '/?fixture=default&timeCompact=3&theme=dark',
    viewport: { width: 1440, height: 900 },
    readySelector: '.lanes-container',
    targetSelector: '.dashboard-wrapper',
    minWidth: 1000,
    minHeight: 500,
    minBytes: 20_000,
    requireCanvas: true,
  },
  {
    name: 'mobile',
    path: '/?fixture=default&theme=dark',
    viewport: { width: 390, height: 844 },
    readySelector: '.lanes-container',
    targetSelector: '.dashboard-wrapper',
    minWidth: 320,
    minHeight: 500,
    minBytes: 10_000,
    requireCanvas: true,
  },
  {
    name: 'capture-render',
    path: '/?fixture=default&capture=72&theme=dark',
    viewport: { width: 1920, height: 1080 },
    readySelector: '[data-capture-ready]',
    targetSelector: '.dashboard-capture-sheet',
    minWidth: 1000,
    minHeight: 500,
    minBytes: 25_000,
    requireCanvas: true,
  },
  {
    name: 'og-image',
    path: '/?fixture=default&og=1&theme=dark',
    viewport: { width: 1200, height: 630 },
    readySelector: '[data-og-ready]',
    targetSelector: '.og-image-canvas',
    minWidth: 1000,
    minHeight: 500,
    minBytes: 25_000,
    requireCanvas: true,
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function serverBaseUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  assert(localUrl, 'Vite dev server URL is unavailable');
  return localUrl.replace(/\/$/, '');
}

async function hasPaintedCanvas(page: Page): Promise<boolean> {
  return page.locator('canvas').evaluateAll((canvases) =>
    canvases.some((element) => {
      if (!(element instanceof HTMLCanvasElement)) return false;
      const context = element.getContext('2d');
      if (!context || element.width <= 0 || element.height <= 0) return false;

      const data = context.getImageData(0, 0, element.width, element.height).data;
      for (let i = 3; i < data.length; i += 64) {
        if ((data[i] ?? 0) > 0) return true;
      }
      return false;
    }),
  );
}

async function assertTargetGeometry(target: Locator, testCase: VisualCase): Promise<void> {
  const box = await target.boundingBox();
  assert(box, `${testCase.name}: target ${testCase.targetSelector} was not rendered`);
  assert(
    box.width >= testCase.minWidth,
    `${testCase.name}: expected width >= ${testCase.minWidth}, got ${box.width}`,
  );
  assert(
    box.height >= testCase.minHeight,
    `${testCase.name}: expected height >= ${testCase.minHeight}, got ${box.height}`,
  );
}

async function runCase(browser: Browser, baseUrl: string, outDir: string, testCase: VisualCase) {
  const page = await browser.newPage({ viewport: testCase.viewport });
  const url = `${baseUrl}${testCase.path}`;

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator(testCase.readySelector).waitFor({ timeout: 30_000 });

  if (testCase.requireCanvas) {
    assert(await hasPaintedCanvas(page), `${testCase.name}: expected at least one painted canvas`);
  }

  const target = page.locator(testCase.targetSelector);
  await assertTargetGeometry(target, testCase);

  const screenshot = await target.screenshot({ type: 'png' });
  assert(
    screenshot.byteLength >= testCase.minBytes,
    `${testCase.name}: screenshot too small (${screenshot.byteLength} bytes)`,
  );

  const outPath = join(outDir, `${testCase.name}.png`);
  await writeFile(outPath, screenshot);
  console.log(`${testCase.name}: ${outPath}`);

  await page.close();
}

async function main(): Promise<void> {
  const outDir = join(tmpdir(), 'weather-dashboard-visual-smoke');
  await mkdir(outDir, { recursive: true });

  const server = await createServer({
    server: { port: 0, strictPort: false },
    logLevel: 'warn',
  });

  await server.listen();
  const baseUrl = serverBaseUrl(server);
  const browser = await chromium.launch();

  try {
    for (const testCase of CASES) {
      await runCase(browser, baseUrl, outDir, testCase);
    }
    console.log(`Visual smoke passed: ${outDir}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
