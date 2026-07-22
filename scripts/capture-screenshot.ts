/**
 * Takes a screenshot of the weather dashboard for the README.
 * Uses the app's built-in capture rendering (DashboardCaptureRender) for
 * pixel-perfect, fixed-width output with header labels.
 *
 * Usage:
 *   tsx scripts/capture-screenshot.ts
 *   tsx scripts/capture-screenshot.ts --capture 72 --themes dark,light
 *   tsx scripts/capture-screenshot.ts --capture 48 --theme dark --output demo.webp
 *   tsx scripts/capture-screenshot.ts --features 0
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import type { Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function readArg(name: string): string | undefined {
  const flag = `--${name}`;
  const inlinePrefix = `${flag}=`;
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg) continue;
    if (arg.startsWith(inlinePrefix)) return arg.slice(inlinePrefix.length);
    if (arg === flag) return process.argv[i + 1];
  }
  return undefined;
}

const fixtureName = readArg('fixture') ?? 'default';
const captureHours = Number(readArg('capture') ?? '72');
const portStr = readArg('port') ?? '0';
const outputName = readArg('output');
const viewport = readArg('viewport') ?? '1920x1080';
const includeFeatureScreenshots =
  readArg('features') !== '0' && outputName == null && fixtureName === 'default';

// Determine which themes to generate
const themeArg = readArg('theme');
const themesArg = readArg('themes') ?? 'dark,light';
const themes: string[] = themeArg
  ? [themeArg]
  : themesArg
      .split(',')
      .map((theme) => theme.trim())
      .filter(Boolean);

const viewportParts = viewport.split('x').map(Number);
const width = viewportParts[0] ?? 0;
const height = viewportParts[1] ?? 0;

if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
  console.error(`Invalid viewport: ${viewport}. Expected WxH, e.g. 1920x1080`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function pngToWebpInBrowser(page: Page, pngBuf: Buffer): Promise<Buffer> {
  const base64 = pngBuf.toString('base64');
  const bytes = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context not available');
    ctx.drawImage(img, 0, 0);
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
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, base64);
  return Buffer.from(bytes);
}

function saveWebp(output: string, image: Buffer): void {
  const outPath = resolve(__dirname, '..', output);
  writeFileSync(outPath, image);
  console.log(`  Saved: ${outPath}`);
}

const FEATURE_VIEWPORT = { width: 1440, height: 900 };

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  Beijing: { latitude: 39.9042, longitude: 116.4074 },
  London: { latitude: 51.5074, longitude: -0.1278 },
  Reykjavik: { latitude: 64.1466, longitude: -21.9426 },
  Tokyo: { latitude: 35.6762, longitude: 139.6503 },
};

const CLOUD_LEVELS = [
  { pressure: 1000, altitude: 36, cover: [0, 0, 5, 10, 15, 10, 5, 0, 0, 0, 0] },
  { pressure: 975, altitude: 259, cover: [5, 10, 20, 35, 50, 70, 80, 65, 35, 10, 0] },
  { pressure: 950, altitude: 487, cover: [10, 15, 30, 55, 75, 90, 95, 75, 45, 20, 5] },
  { pressure: 925, altitude: 721, cover: [5, 20, 45, 70, 90, 95, 85, 60, 35, 15, 5] },
  { pressure: 900, altitude: 959, cover: [0, 10, 35, 60, 80, 90, 75, 45, 20, 5, 0] },
  { pressure: 850, altitude: 1452, cover: [0, 5, 20, 40, 60, 75, 55, 30, 10, 0, 0] },
  { pressure: 800, altitude: 1967, cover: [0, 0, 5, 15, 30, 45, 55, 45, 25, 10, 0] },
  { pressure: 700, altitude: 3077, cover: [0, 0, 5, 15, 35, 55, 75, 90, 80, 50, 20] },
  { pressure: 600, altitude: 4315, cover: [5, 10, 20, 35, 55, 70, 85, 95, 90, 70, 45] },
  { pressure: 500, altitude: 5731, cover: [20, 30, 45, 60, 75, 85, 90, 85, 70, 50, 30] },
  { pressure: 400, altitude: 7396, cover: [35, 45, 55, 65, 70, 75, 80, 85, 90, 85, 70] },
  { pressure: 300, altitude: 9431, cover: [55, 60, 65, 70, 75, 80, 85, 90, 95, 90, 80] },
  { pressure: 250, altitude: 10650, cover: [45, 50, 55, 65, 75, 85, 90, 90, 85, 75, 60] },
  { pressure: 200, altitude: 12077, cover: [20, 25, 35, 45, 60, 70, 75, 70, 60, 45, 30] },
] as const;

function sunCloudFixtureResponse(): unknown[] {
  return Array.from({ length: 11 }, (_, index) => {
    const hourly: Record<string, Array<string | number>> = {
      time: ['2026-06-13T05:00'],
      cloud_cover_low: [
        Math.max(...CLOUD_LEVELS.slice(0, 6).map((level) => level.cover[index] ?? 0)),
      ],
      cloud_cover_mid: [
        Math.max(...CLOUD_LEVELS.slice(6, 10).map((level) => level.cover[index] ?? 0)),
      ],
      cloud_cover_high: [
        Math.max(...CLOUD_LEVELS.slice(10).map((level) => level.cover[index] ?? 0)),
      ],
    };

    for (const level of CLOUD_LEVELS) {
      hourly[`cloud_cover_${level.pressure}hPa`] = [level.cover[index] ?? 0];
      hourly[`geopotential_height_${level.pressure}hPa`] = [level.altitude];
    }

    return {
      latitude: 39.9042 + index * 0.08,
      longitude: 116.4074 + index * 0.22,
      utc_offset_seconds: 8 * 60 * 60,
      hourly,
    };
  });
}

async function installFeatureScreenshotRoutes(page: Page): Promise<void> {
  await page.route('**/fixtures/*.json', async (route) => {
    const response = await route.fetch();
    const fixture = (await response.json()) as {
      points?: Array<{
        cityName?: string;
        latitude?: number;
        longitude?: number;
      }>;
    };

    for (const point of fixture.points ?? []) {
      if (!point.cityName) continue;
      const coordinates = CITY_COORDINATES[point.cityName];
      if (!coordinates) continue;
      point.latitude ??= coordinates.latitude;
      point.longitude ??= coordinates.longitude;
    }

    await route.fulfill({ response, json: fixture });
  });

  await page.route(/https:\/\/api\.open-meteo\.com\/v1\/forecast/, async (route) => {
    await route.fulfill({ json: sunCloudFixtureResponse() });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function captureTheme(theme: string, serverPort: number): Promise<void> {
  const outName = outputName ?? `demo-${theme}.webp`;
  const outPath = resolve(__dirname, '..', outName);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });

  const url = `http://localhost:${serverPort}/?fixture=${encodeURIComponent(fixtureName)}&capture=${captureHours}&theme=${theme}`;
  console.log(`  [${theme}] Opening: ${url}`);

  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for the capture element to be ready (canvases drawn)
  await page.waitForSelector('[data-capture-ready]', { timeout: 30000 });

  // Additional wait for any remaining canvas animations
  await page.waitForTimeout(1000);

  const captureEl = page.locator('.dashboard-capture-sheet');
  const box = await captureEl.boundingBox();
  if (!box) {
    console.error(`  [${theme}] Error: .dashboard-capture-sheet not found`);
    await browser.close();
    return;
  }

  console.log(`  [${theme}] Capture size: ${Math.round(box.width)}×${Math.round(box.height)}px`);

  // Screenshot the capture element as PNG, then encode to WebP in the browser
  const pngBuf = await captureEl.screenshot({ type: 'png' });
  const webpBuf = await pngToWebpInBrowser(page, pngBuf);

  await browser.close();

  writeFileSync(outPath, webpBuf);
  console.log(`  [${theme}] Saved: ${outPath}`);
}

async function captureFeatureScreenshots(theme: string, serverPort: number): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: FEATURE_VIEWPORT });
  await installFeatureScreenshotRoutes(page);

  const url = `http://localhost:${serverPort}/?fixture=${encodeURIComponent(fixtureName)}&theme=${theme}`;
  console.log(`  [${theme}] Opening feature gallery: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.lanes-container').waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: '打开 Beijing 12:00 的 Skew-T' }).click();
  await page.locator('.sounding-drawer:not(.sun-cloud-drawer)').waitFor({ timeout: 10000 });
  await page.waitForTimeout(250);
  const soundingPng = await page.screenshot({ type: 'png' });
  saveWebp(`feature-sounding-${theme}.webp`, await pngToWebpInBrowser(page, soundingPng));

  await page.getByRole('button', { name: '关闭 Skew-T', exact: true }).click();
  await page.locator('.sounding-drawer').waitFor({ state: 'hidden', timeout: 10000 });
  await page.getByRole('button', { name: '打开日出方向云况剖面' }).first().click();
  await page.locator('.sun-cloud-canvas-wrap canvas').waitFor({ timeout: 10000 });
  await page.waitForTimeout(250);
  const sunCloudPng = await page.screenshot({ type: 'png' });
  saveWebp(`feature-sun-cloud-${theme}.webp`, await pngToWebpInBrowser(page, sunCloudPng));

  await browser.close();
}

async function main() {
  console.log(`Capturing ${captureHours}-hour fixture "${fixtureName}" for: ${themes.join(', ')}`);

  const server = await createServer({
    server: { port: Number(portStr), strictPort: false },
    logLevel: 'warn',
  });
  await server.listen();
  const serverPort = server.config.server.port;
  console.log(`Dev server ready on port ${serverPort}\n`);

  for (const theme of themes) {
    await captureTheme(theme, serverPort);
    if (includeFeatureScreenshots) {
      await captureFeatureScreenshots(theme, serverPort);
    }
    console.log();
  }

  await server.close();
  console.log('Done!');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
