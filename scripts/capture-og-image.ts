/**
 * Generates a 1280x640 repository social preview image for GitHub.
 *
 * Usage:
 *   tsx scripts/capture-og-image.ts
 *   tsx scripts/capture-og-image.ts --fixture default --hours 72
 *   tsx scripts/capture-og-image.ts --theme dark --formats png,webp
 *   tsx scripts/capture-og-image.ts --theme dark --format png --output og-image.png
 */

import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import type { Page } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
const hoursArg = readArg('hours') ?? '72';
const hours = Number(hoursArg);
const portStr = readArg('port') ?? '0';
const outputName = readArg('output');
const themeArg = readArg('theme');
const themesArg = readArg('themes') ?? 'dark,light';
const formatArg = readArg('format');
const formatsArg = readArg('formats') ?? 'png,webp';
const requestedThemes = themeArg
  ? [themeArg]
  : themesArg.split(',').map((theme) => theme.trim()).filter(Boolean);
const requestedFormats = formatArg
  ? [formatArg]
  : formatsArg.split(',').map((format) => format.trim()).filter(Boolean);

if (!Number.isFinite(hours) || hours <= 0) {
  console.error(`Invalid hours: ${hoursArg}. Expected a positive number.`);
  process.exit(1);
}

if (requestedThemes.some((theme) => theme !== 'dark' && theme !== 'light')) {
  console.error(`Invalid theme list: ${requestedThemes.join(', ')}. Expected "dark", "light", or both.`);
  process.exit(1);
}

function normalizeFormat(format: string): 'png' | 'jpeg' | 'webp' | null {
  if (format === 'jpg') return 'jpeg';
  if (format === 'png' || format === 'jpeg' || format === 'webp') return format;
  return null;
}

const formats = requestedFormats.map(normalizeFormat);

if (formats.some((format) => format == null)) {
  console.error(`Invalid format list: ${requestedFormats.join(', ')}. Expected "png", "jpg", "jpeg", "webp", or a comma-separated list.`);
  process.exit(1);
}

const outputFormats = formats.filter((format): format is 'png' | 'jpeg' | 'webp' => format != null);

function extensionForFormat(format: 'png' | 'jpeg' | 'webp'): string {
  return format === 'jpeg' ? 'jpg' : format;
}

function outputNameForTheme(theme: string, format: 'png' | 'jpeg' | 'webp'): string {
  const formatExt = extensionForFormat(format);
  if (!outputName) return `og-image-${theme}.${formatExt}`;
  if (requestedThemes.length === 1 && outputFormats.length === 1) return outputName;
  if (outputName.includes('{theme}') || outputName.includes('{format}')) {
    return outputName.replaceAll('{theme}', theme).replaceAll('{format}', formatExt);
  }

  const ext = extname(outputName);
  const baseName = ext ? outputName.slice(0, -ext.length) : outputName;
  const suffix = [
    requestedThemes.length > 1 ? theme : null,
    outputFormats.length > 1 ? formatExt : null,
  ].filter(Boolean).join('-');
  return `${baseName}-${suffix}.${formatExt}`;
}

async function captureTheme(
  page: Page,
  serverPort: number,
  theme: string,
): Promise<Buffer> {
  const url = `http://localhost:${serverPort}/?fixture=${encodeURIComponent(fixtureName)}&og=1&ogHours=${hours}&theme=${theme}`;
  console.log(`  [${theme}] Opening: ${url}`);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-og-ready]', { timeout: 30000 });
  await page.waitForTimeout(500);

  const canvas = page.locator('.og-image-canvas');
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('.og-image-canvas not found');
  }

  console.log(`  [${theme}] Capture size: ${Math.round(box.width)}x${Math.round(box.height)}px`);
  if (Math.round(box.width) !== 1280 || Math.round(box.height) !== 640) {
    throw new Error(`Expected 1280x640 capture, got ${Math.round(box.width)}x${Math.round(box.height)}`);
  }

  return canvas.screenshot({ type: 'png' });
}

async function convertPngInBrowser(
  page: Page,
  png: Buffer,
  format: 'jpeg' | 'webp',
): Promise<Buffer> {
  const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
  const quality = format === 'webp' ? 0.86 : 0.92;
  const base64 = png.toString('base64');
  const bytes = await page.evaluate(async ({ base64Png, targetMime, imageQuality }) => {
    const img = new Image();
    await new Promise<void>((resolveLoad, rejectLoad) => {
      img.onload = () => resolveLoad();
      img.onerror = () => rejectLoad(new Error('Image load failed'));
      img.src = `data:image/png;base64,${base64Png}`;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context not available');
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolveBlob, rejectBlob) => {
      canvas.toBlob((b) => {
        if (b) resolveBlob(b);
        else rejectBlob(new Error(`${targetMime} encoding failed`));
      }, targetMime, imageQuality);
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { base64Png: base64, targetMime: mimeType, imageQuality: quality });

  return Buffer.from(bytes);
}

function saveImage(outputName: string, image: Buffer, theme: string): void {
  const outPath = resolve(__dirname, '..', outputName);
  writeFileSync(outPath, image);
  const sizeKB = statSync(outPath).size / 1024;
  console.log(`  [${theme}] Saved: ${outPath} (${sizeKB.toFixed(1)} KB)`);

  if (sizeKB > 1024) {
    console.warn(`  [${theme}] Warning: GitHub recommends social preview images under 1 MB.`);
  }
}

async function main() {
  console.log(`Generating GitHub OG images from fixture "${fixtureName}" (${hours} hours): ${requestedThemes.join(', ')} / ${outputFormats.join(', ')}`);

  const server = await createServer({
    server: { port: Number(portStr), strictPort: false },
    logLevel: 'warn',
  });

  await server.listen();
  const serverPort = server.config.server.port;
  console.log(`Dev server ready on port ${serverPort}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 1,
  });

  for (const theme of requestedThemes) {
    const png = await captureTheme(page, serverPort, theme);

    for (const format of outputFormats) {
      const image = format === 'png' ? png : await convertPngInBrowser(page, png, format);
      saveImage(outputNameForTheme(theme, format), image, theme);
    }
  }

  await browser.close();
  await server.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
