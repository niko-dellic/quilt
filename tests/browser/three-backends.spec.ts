import { test, expect, type Page } from '@playwright/test';
import type {} from './three.spec.js';
import type {} from './three-lifecycle.js';

async function imageSamples(page: Page) {
  const image = (await page.screenshot()).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return ['perspective', 'front'].map((id) => {
      const box = document.querySelector(`[data-pane-id="${id}"]`)!.getBoundingClientRect();
      return [
        ...ctx.getImageData(
          Math.floor(((box.x + box.width * 0.55) * image.width) / innerWidth),
          Math.floor(((box.y + box.height * 0.55) * image.height) / innerHeight),
          1,
          1,
        ).data,
      ];
    });
  }, image);
}
for (const fallback of [false, true])
  for (const framework of ['vanilla', 'react']) {
    test(`${framework}: ${fallback ? 'WebGPU renderer WebGL fallback' : 'native WebGPU'} renders isolated effects, clips, picks, and returns companions`, async ({
      page,
    }, testInfo) => {
      await page.goto('/');
      if (!fallback) {
        const available = await page.evaluate(async () => {
          const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })
            .gpu;
          return !!(await gpu?.requestAdapter());
        });
        if (testInfo.project.name === 'chromium-webgpu') expect(available).toBe(true);
        test.skip(
          !available,
          'No native WebGPU adapter in this browser environment; fallback tested separately',
        );
      }
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(
        `/${framework}.html?workspace=three&renderer=webgpu&effects${fallback ? '&forceWebGL' : ''}`,
      );
      await expect
        .poll(() => page.evaluate(() => window.threeDemo?.session?.stats.drawCalls))
        .toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () =>
            (
              window.threeDemo.session.getViews()[0]!.surface
                .renderer as import('three/webgpu').WebGPURenderer
            ).backend.constructor.name,
        ),
      ).toBe(fallback ? 'WebGLBackend' : 'WebGPUBackend');
      for (const width of [1100, 800]) {
        await page.setViewportSize({ width, height: 720 });
        await page.evaluate(() => window.threeDemo.session.invalidate());
        await expect
          .poll(async () => {
            const [gray, color] = await imageSamples(page);
            return Math.abs(gray![0]! - gray![1]!) < 3 && color![1]! - color![0]! > 10;
          })
          .toBe(true);
      }
      await page.locator('[data-pane-id="front"] [data-quilt-three-input]').click();
      await expect(page.locator('#status')).toContainText('object selected');
      // Exercise a partially clipped viewport; WebGPU rejects negative viewport coordinates.
      await page.evaluate(() => {
        const view = window.threeDemo.session
          .getViews()
          .find((v) => v.context.pane.id === 'perspective')!;
        view.element.style.left = '-100px';
        window.threeDemo.session.invalidate();
      });
      await page.waitForTimeout(100);
      expect(
        await page.evaluate(
          () =>
            (window.threeDemo.cameras.get('perspective') as import('three').PerspectiveCamera).view
              ?.enabled ?? false,
        ),
      ).toBe(false);
      await page.evaluate(() => {
        window.threeDemo.session
          .getViews()
          .find((v) => v.context.pane.id === 'perspective')!.element.style.left = '';
        window.threeDemo.session.invalidate();
      });
      const mounts = await page.evaluate(() => window.threeDemo.counters?.mounts);
      const resources = await page.evaluate(() => {
        const { geometries, textures } = window.threeDemo.session.stats;
        return { geometries, textures };
      });
      for (let cycle = 0; cycle < 2; cycle++) {
        const opened = page.waitForEvent('popup');
        await page.getByRole('button', { name: 'Perspective actions', exact: true }).click();
        await page.getByRole('button', { name: 'Open in window', exact: true }).click();
        const popup = await opened;
        await expect
          .poll(() => page.evaluate(() => window.threeDemo.session.stats.documents))
          .toBe(2);
        await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(4);
        await popup.close();
        await expect
          .poll(() => page.evaluate(() => window.threeDemo.session.stats.documents))
          .toBe(1);
      }
      expect(await page.evaluate(() => window.threeDemo.counters?.mounts)).toBe(mounts);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const { geometries, textures } = window.threeDemo.session.stats;
            return { geometries, textures };
          }),
        )
        .toEqual(resources);
      await page.evaluate(async () => {
        window.threeDemo.workspace.dispose();
        await window.threeDemo.session.dispose();
      });
      await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
for (const react of [false, true])
  for (const webgpu of [false, true]) {
    test(`${react ? 'R3F StrictMode' : 'vanilla'} ${webgpu ? 'async GPU' : 'WebGL'} repeated mount/dispose releases renderers but retains assets`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/tests/browser/three-lifecycle.html');
      for (let cycle = 0; cycle < 3; cycle++) {
        await page.evaluate(({ react, webgpu }) => window.graphicsAudit.mount(react, webgpu), {
          react,
          webgpu,
        });
        await expect
          .poll(() => page.evaluate(() => window.graphicsAudit.session?.stats.drawCalls))
          .toBeGreaterThan(0);
        await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(1);
        await page.evaluate(() => window.graphicsAudit.unmount());
        await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(0);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const s = window.graphicsAudit.stats;
              return s.initialized - s.disposed;
            }),
          )
          .toBe(0);
        expect(await page.evaluate(() => window.graphicsAudit.stats.assetDisposals)).toBe(0);
      }
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => window.graphicsAudit.stats.errors)).toEqual([]);
    });
  }
test('async renderer rejection and closure while pending preserve the source and dispose late resources', async ({
  page,
}) => {
  await page.goto('/tests/browser/three-lifecycle.html');
  await page.evaluate(() => window.graphicsAudit.mount());
  await expect
    .poll(() => page.evaluate(() => window.graphicsAudit.session.stats.drawCalls))
    .toBeGreaterThan(0);
  await page.evaluate(() => window.graphicsAudit.delay(true));
  for (const reject of [true, false]) {
    const opened = page.waitForEvent('popup');
    await page.getByText('Pop out', { exact: true }).click();
    const popup = await opened;
    await expect.poll(() => page.evaluate(() => window.graphicsAudit.stats.pending)).toBe(1);
    await expect(page.locator('[data-pane-id="view"]')).toBeVisible();
    if (!reject) await popup.close();
    await page.evaluate((reject) => window.graphicsAudit.settle(reject), reject);
    await expect
      .poll(() => page.evaluate(() => window.graphicsAudit.session.stats.documents))
      .toBe(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = window.graphicsAudit.stats;
          return s.initialized - s.disposed;
        }),
      )
      .toBe(1);
    await expect(page.locator('[data-pane-id="view"]')).toBeVisible();
  }
  await page.evaluate(() => window.graphicsAudit.unmount());
  expect(await page.evaluate(() => window.graphicsAudit.stats.assetDisposals)).toBe(0);
});

for (const react of [false, true]) {
  test(`${react ? 'R3F' : 'vanilla'} disposes an asynchronous factory result returned after unmount`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/tests/browser/three-lifecycle.html');
    await page.evaluate((react) => window.graphicsAudit.mount(react, false, true), react);
    await expect
      .poll(() => page.evaluate(() => window.graphicsAudit.stats.pending))
      .toBeGreaterThan(0);
    await page.evaluate(() => {
      void window.graphicsAudit.unmount();
    });
    await page.evaluate(() => window.graphicsAudit.settle());
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = window.graphicsAudit.stats;
          return s.initialized - s.disposed;
        }),
      )
      .toBe(0);
    await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('camera projection survives moving from WebGL to native WebGPU and back', async ({
  page,
}, testInfo) => {
  await page.goto('/tests/browser/three-lifecycle.html');
  const available = await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter()));
  if (testInfo.project.name === 'chromium-webgpu') expect(available).toBe(true);
  test.skip(!available, 'No native adapter in this browser environment');
  await page.evaluate(() => window.graphicsAudit.mount(false, false, false, true));
  await expect
    .poll(() => page.evaluate(() => window.graphicsAudit.session.stats.drawCalls))
    .toBeGreaterThan(0);
  const coordinateSystem = await page.evaluate(() => window.graphicsAudit.camera.coordinateSystem);
  const opened = page.waitForEvent('popup');
  await page.getByText('Pop out', { exact: true }).click();
  const popup = await opened;
  await expect.poll(() => page.evaluate(() => window.graphicsAudit.session.stats.views)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.graphicsAudit.camera.coordinateSystem))
    .not.toBe(coordinateSystem);
  await popup.close();
  await expect
    .poll(() => page.evaluate(() => window.graphicsAudit.session.stats.documents))
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.graphicsAudit.camera.coordinateSystem))
    .toBe(coordinateSystem);
  await page.evaluate(() => window.graphicsAudit.unmount());
  expect(await page.evaluate(() => window.graphicsAudit.stats.errors)).toEqual([]);
});

test.describe('WebGPU high DPI', () => {
  test.use({ deviceScaleFactor: 3 });
  test('caps pixel ratio and clips without GPU validation errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/vanilla.html?workspace=three&renderer=webgpu&effects');
    await expect
      .poll(() => page.evaluate(() => window.threeDemo?.session?.stats.drawCalls))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('[data-quilt-three-canvas]')!;
          return Math.abs(canvas.width - canvas.getBoundingClientRect().width * 2);
        }),
      )
      .toBeLessThanOrEqual(1);
    await page.evaluate(() => {
      window.threeDemo.session
        .getViews()
        .find((view) => view.context.pane.id === 'perspective')!.element.style.left = '-80px';
      window.threeDemo.session.render(performance.now());
    });
    await page.screenshot();
    await page.evaluate(async () => {
      window.threeDemo.workspace.dispose();
      await window.threeDemo.session.dispose();
    });
    expect(errors).toEqual([]);
  });
});
