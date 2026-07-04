import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function serverBaseUrl(server: ViteDevServer): string {
  const localUrl = server.resolvedUrls?.local[0];
  assert(localUrl, 'Vite dev server URL is unavailable');
  return localUrl.replace(/\/$/, '');
}

async function expectSearchParam(page: Page, name: string, value: string | null): Promise<void> {
  await page.waitForFunction(
    ({ paramName, expected }: { paramName: string; expected: string | null }) =>
      new URL(window.location.href).searchParams.get(paramName) === expected,
    { paramName: name, expected: value },
  );
}

async function waitForDashboard(page: Page): Promise<void> {
  await page.locator('.lanes-container').waitFor({ state: 'visible', timeout: 30_000 });
  const cellCount = await page.locator('.lane-cell').count();
  assert(cellCount > 24, `Expected rendered timeline cells, got ${cellCount}`);
}

async function expectNonBlankCanvas(page: Page): Promise<void> {
  const paintedCanvasCount = await page.locator('canvas').evaluateAll(
    (canvases) =>
      canvases.filter((element) => {
        if (!(element instanceof HTMLCanvasElement)) return false;
        const canvas = element;
        const context = canvas.getContext('2d');
        if (!context || canvas.width <= 0 || canvas.height <= 0) return false;

        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 64) {
          if ((data[i] ?? 0) > 0) return true;
        }
        return false;
      }).length,
  );

  assert(paintedCanvasCount > 0, 'Expected at least one non-blank dashboard canvas');
}

async function expectNamedControls(page: Page): Promise<void> {
  const unnamedControls = await page
    .locator('button, a[href], [role="button"], [role="menuitem"]')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        })
        .filter((element) => {
          const labelledBy = element.getAttribute('aria-labelledby');
          const hasLabelledByText =
            labelledBy
              ?.split(/\s+/)
              .some((id) => Boolean(document.getElementById(id)?.textContent?.trim())) ?? false;

          return !(
            element.textContent?.trim() ||
            element.getAttribute('aria-label')?.trim() ||
            element.getAttribute('title')?.trim() ||
            hasLabelledByText
          );
        })
        .map((element) => element.outerHTML.slice(0, 160)),
    );

  assert(
    unnamedControls.length === 0,
    `Found visible controls without accessible names:\n${unnamedControls.join('\n')}`,
  );
}

async function runDesktopSmoke(browser: Browser, baseUrl: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${baseUrl}/?fixture=default&theme=dark`, { waitUntil: 'networkidle' });
  await waitForDashboard(page);
  await expectNonBlankCanvas(page);
  await expectNamedControls(page);

  await page.getByRole('button', { name: '切换到紧凑视图' }).click();
  await expectSearchParam(page, 'compact', '1');
  await page.getByRole('button', { name: '切换到完整视图' }).waitFor();

  await page.getByRole('button', { name: '切换到 3 小时一格' }).click();
  await expectSearchParam(page, 'timeCompact', '3');
  await page.getByRole('button', { name: '切换到 6 小时一格' }).waitFor();

  await page.getByRole('button', { name: '进入截图模式' }).click();
  await page.getByLabel('截图工具栏').waitFor();
  await page.getByRole('button', { name: '退出截图模式' }).click();
  await page.getByRole('button', { name: '进入截图模式' }).waitFor();

  await page.close();
}

async function runMobileSmoke(browser: Browser, baseUrl: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${baseUrl}/?fixture=default&theme=dark`, { waitUntil: 'networkidle' });
  await waitForDashboard(page);

  await page.getByRole('button', { name: '打开工具菜单' }).click();
  await page.getByRole('menu', { name: '工具' }).waitFor();
  await page.getByRole('menuitem', { name: '进入截图模式' }).waitFor();
  await expectNamedControls(page);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '打开工具菜单' }).waitFor();

  await page.close();
}

async function runCaptureSmoke(browser: Browser, baseUrl: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto(`${baseUrl}/?fixture=default&capture=24&theme=dark`, {
    waitUntil: 'networkidle',
  });
  await page.locator('[data-capture-ready]').waitFor({ timeout: 30_000 });

  const box = await page.locator('.dashboard-capture-sheet').boundingBox();
  assert(box, 'Capture sheet was not rendered');
  assert(box.width > 500, `Capture sheet width is unexpectedly small: ${box.width}`);
  assert(box.height > 300, `Capture sheet height is unexpectedly small: ${box.height}`);

  await page.close();
}

async function main(): Promise<void> {
  const server = await createServer({
    server: { port: 0, strictPort: false },
    logLevel: 'warn',
  });

  await server.listen();
  const baseUrl = serverBaseUrl(server);
  const browser = await chromium.launch();

  try {
    await runDesktopSmoke(browser, baseUrl);
    await runMobileSmoke(browser, baseUrl);
    await runCaptureSmoke(browser, baseUrl);
    console.log('E2E smoke passed');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
