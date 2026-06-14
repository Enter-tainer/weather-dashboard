/**
 * Takes a screenshot of the weather dashboard for the README.
 * Uses the app's built-in capture rendering (DashboardCaptureRender) for
 * pixel-perfect, fixed-width output with header labels.
 *
 * Usage:
 *   tsx scripts/capture-screenshot.ts
 *   tsx scripts/capture-screenshot.ts --capture 72 --themes dark,light
 *   tsx scripts/capture-screenshot.ts --capture 48 --theme dark --output demo.webp
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

// Determine which themes to generate
const themeArg = readArg('theme');
const themesArg = readArg('themes') ?? 'dark,light';
const themes: string[] = themeArg
  ? [themeArg]
  : themesArg.split(',').map((theme) => theme.trim()).filter(Boolean);

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
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('WebP encoding failed'));
      }, 'image/webp', 0.85);
    });
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, base64);
  return Buffer.from(bytes);
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
    console.log();
  }

  await server.close();
  console.log('Done!');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
