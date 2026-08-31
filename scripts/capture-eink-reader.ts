import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const CASES = [
  {
    name: 'portrait',
    viewport: { width: 936, height: 1248 },
    screen: { width: 936, height: 1248 },
  },
  {
    name: 'landscape',
    viewport: { width: 1248, height: 936 },
    screen: { width: 1248, height: 936 },
  },
] as const;

async function main() {
  const outputDirectory = resolve('artifacts/eink-reader');
  await mkdir(outputDirectory, { recursive: true });
  const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'warn' });
  await server.listen();
  const baseUrl = server.resolvedUrls?.local[0]?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('Vite did not provide a local URL');

  const browser = await chromium.launch();
  try {
    for (const item of CASES) {
      const context = await browser.newContext({
        viewport: item.viewport,
        screen: item.screen,
        deviceScaleFactor: 1.5,
        hasTouch: true,
        isMobile: true,
        reducedMotion: 'reduce',
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/?fixture=default&display=eink&layout=reader&immersive=true`, {
        waitUntil: 'networkidle',
      });
      await page.locator('.lanes-container').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);

      const metrics = await page.evaluate(() => {
        const lanes = document.querySelector('.lanes-container')?.getBoundingClientRect();
        const legend = document.querySelector('.legend-sidebar')?.getBoundingClientRect();
        const firstCell = document.querySelector('.lane-cell')?.getBoundingClientRect();
        return {
          devicePixelRatio,
          viewport: { width: innerWidth, height: innerHeight },
          lanesHeight: lanes?.height ?? null,
          legendWidth: legend?.width ?? null,
          hourWidth: firstCell?.width ?? null,
        };
      });

      const screenshot = await page.screenshot({ type: 'png', scale: 'device' });
      const screenshotPath = resolve(outputDirectory, `notex-reader-${item.name}.png`);
      const metricsPath = resolve(outputDirectory, `notex-reader-${item.name}.json`);
      await writeFile(screenshotPath, screenshot);
      await writeFile(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
      console.log(`${item.name}: ${screenshotPath}`);
      console.log(metrics);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
