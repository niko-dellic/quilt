import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import type { ThreeSession } from 'quilt-three';
import type { WorkspaceHandle } from 'quilt-vanilla';
import type { Camera } from 'three';

declare global {
  interface Window {
    threeDemo: {
      session: ThreeSession;
      workspace: WorkspaceHandle;
      cameras: Map<string, Camera>;
      counters?: { mounts: number; unmounts: number; ticks: number; clicks: number };
    };
  }
}
async function popoutPerspective(page: Page) {
  await page.getByRole('button', { name: 'Perspective actions', exact: true }).click();
  await page.getByRole('button', { name: 'Open in window', exact: true }).click();
}
for (const pageName of ['three', 'three-react']) {
  for (const effect of [false, true]) {
    test(`${pageName}${effect ? ' with effects' : ''}: four views share graphics, pick, pop out, and clean up`, async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== 'chromium',
        'WebGL integration is validated with Chromium software GL in CI',
      );
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(
        `/${pageName === 'three' ? 'vanilla' : 'react'}.html?workspace=three${effect ? '&effects' : ''}`,
      );
      await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
      await expect
        .poll(() => page.evaluate(() => window.threeDemo.session.stats.drawCalls))
        .toBeGreaterThan(0);
      await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(1);
      await expect(page.locator('.layouts > [data-quilt-three-canvas]')).toHaveCount(1);
      const front = page.locator('[data-pane-id="front"]');
      await front.click();
      await expect(page.locator('#status')).toContainText('object selected');
      const mounts = await page.evaluate(() => window.threeDemo.counters?.mounts);
      const pose = await page.evaluate(() =>
        window.threeDemo.cameras.get('perspective')!.position.toArray(),
      );
      const popupPromise = page.waitForEvent('popup');
      await popoutPerspective(page);
      const popup = await popupPromise;
      await expect(popup.locator('[data-quilt-three-canvas]')).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(4);
      await expect
        .poll(() => page.evaluate(() => window.threeDemo.session.stats.documents))
        .toBe(2);
      if (pageName === 'three-react') {
        await popup.locator('[data-pane-id="perspective"]').click();
        await expect.poll(() => page.evaluate(() => window.threeDemo.counters?.clicks)).toBe(2);
      }
      await popup.close();
      await expect
        .poll(() => page.evaluate(() => window.threeDemo.session.stats.documents))
        .toBe(1);
      expect(
        await page.evaluate(() => window.threeDemo.cameras.get('perspective')!.position.toArray()),
      ).toEqual(pose);
      expect(await page.evaluate(() => window.threeDemo.counters?.mounts)).toBe(mounts);
      await page.evaluate(() => {
        window.threeDemo.workspace.dispose();
        window.threeDemo.session.dispose();
      });
      await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}

test('Three rollback, hidden views, resize, demand scheduling, and repeated disposal', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Requires WebGL');
  await page.goto('/vanilla.html?workspace=three&failPopout');
  await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
  const before = await page.evaluate(() => window.threeDemo.session.stats.drawCalls);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-pane-id="top"]')!.hidden = true;
  });
  await expect
    .poll(() => page.evaluate(() => window.threeDemo.session.stats.drawCalls))
    .toBeLessThan(before);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-pane-id="top"]')!.hidden = false;
  });
  await expect
    .poll(() => page.evaluate(() => window.threeDemo.session.stats.drawCalls))
    .toBe(before);
  await page.setViewportSize({ width: 900, height: 620 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector('canvas')!;
        return Math.abs(canvas.width - canvas.getBoundingClientRect().width);
      }),
    )
    .toBeLessThanOrEqual(1);
  await page.waitForTimeout(250);
  const frames = await page.evaluate(() => window.threeDemo.session.stats.frames);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.threeDemo.session.stats.frames)).toBe(frames);
  await popoutPerspective(page);
  await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.documents)).toBe(1);
  await expect(page.locator('[data-pane-id="perspective"]')).toBeVisible();
  await page.evaluate(() => window.threeDemo.workspace.updateOptions({ openWindow: () => null }));
  await popoutPerspective(page);
  await expect(page.locator('[data-pane-id="perspective"]')).toBeVisible();
  await page.evaluate(() => {
    window.threeDemo.session.dispose();
    window.threeDemo.session.dispose();
  });
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('effect output is isolated to its pane, including after resize', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Requires WebGL');
  await page.goto('/react.html?workspace=three&effects');
  await expect
    .poll(() => page.evaluate(() => window.threeDemo?.session?.stats.drawCalls))
    .toBeGreaterThan(0);
  const pixels = () =>
    page.evaluate(() => {
      window.threeDemo.session.render(performance.now());
      const canvas = document.querySelector<HTMLCanvasElement>('[data-quilt-three-canvas]')!;
      const gl = canvas.getContext('webgl2')!;
      const box = canvas.getBoundingClientRect();
      return ['perspective', 'front'].map((id) => {
        const pane = document.querySelector(`[data-pane-id="${id}"]`)!.getBoundingClientRect();
        const bytes = new Uint8Array(4);
        gl.readPixels(
          Math.floor(((pane.x + pane.width * 0.55 - box.x) * canvas.width) / box.width),
          Math.floor(((box.bottom - pane.y - pane.height * 0.55) * canvas.height) / box.height),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bytes,
        );
        return [...bytes];
      });
    });
  for (const width of [1100, 800]) {
    await page.setViewportSize({ width, height: 720 });
    await page.waitForTimeout(100);
    const [gray, color] = await pixels();
    expect(gray![3]).toBe(255);
    expect(Math.abs(gray![0]! - gray![1]!)).toBeLessThan(3);
    expect(color![1]! - color![0]!).toBeGreaterThan(10);
  }
});

for (const demo of ['three', 'three-react']) {
  test(`${demo}: retained views, new cameras, and a hidden opener`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${demo === 'three' ? 'vanilla' : 'react'}.html?workspace=three`);
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    expect(
      await page.evaluate(() => {
        const { workspace } = window.threeDemo;
        const view = document.querySelector('[data-pane-id="front"] [data-quilt-three-input]');
        workspace.movePane('front', 'group-top');
        workspace.activatePane('front');
        workspace.maximize('group-top');
        workspace.maximize(null);
        return view === document.querySelector('[data-pane-id="front"] [data-quilt-three-input]');
      }),
    ).toBe(true);
    await page.evaluate(() => {
      const workspace = window.threeDemo.workspace;
      const layout = workspace.exportLayout();
      layout.panes.extra = { id: 'extra', type: 'three', title: 'Extra camera' };
      const place = (node: import('quilt-core').Node): void => {
        if (node.kind === 'split') node.children.forEach(place);
        else if (node.id === 'group-side') {
          node.panes.push('extra');
          node.active = 'extra';
        }
      };
      place(layout.root);
      workspace.loadLayout(layout);
    });
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(5);
    expect(await page.evaluate(() => window.threeDemo.cameras.has('extra'))).toBe(true);
    await page.evaluate(() => window.threeDemo.workspace.closePane('extra', { force: true }));
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(4);
    const popupPromise = page.waitForEvent('popup');
    await popoutPerspective(page);
    const popup = await popupPromise;
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.documents)).toBe(2);
    await popup.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window);
      Object.assign(window, { scheduledFrames: 0 });
      window.requestAnimationFrame = (callback) => {
        (window as unknown as { scheduledFrames: number }).scheduledFrames++;
        return original(callback);
      };
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.threeDemo.session.invalidate();
    });
    await expect
      .poll(() =>
        popup.evaluate(() => (window as unknown as { scheduledFrames: number }).scheduledFrames),
      )
      .toBeGreaterThan(0);
    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await popup.close();
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.documents)).toBe(1);
  });
}

test('Three high-DPI cap, zero size, pointer capture, and application resource ownership', async ({
  browser,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'chromium', 'Requires WebGL');
  const context = await browser.newContext({ deviceScaleFactor: 3, baseURL: baseURL! });
  const page = await context.newPage();
  try {
    await page.goto('/vanilla.html?workspace=three');
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector('canvas')!;
          return Math.abs(canvas.width - canvas.getBoundingClientRect().width * 2);
        }),
      )
      .toBeLessThanOrEqual(1);
    const before = await page.evaluate(() => window.threeDemo.session.stats.drawCalls);
    await page.locator('[data-pane-id="top"]').evaluate((element) => {
      (element as HTMLElement).style.height = '0px';
    });
    await expect
      .poll(() => page.evaluate(() => window.threeDemo.session.stats.drawCalls))
      .toBeLessThan(before);
    await page.locator('[data-pane-id="top"]').evaluate((element) => {
      (element as HTMLElement).style.height = '100%';
    });
    const frontPose = await page.evaluate(() =>
      window.threeDemo.cameras.get('front')!.position.toArray(),
    );
    const perspective = await page.locator('[data-pane-id="perspective"]').boundingBox();
    const side = await page.locator('[data-pane-id="side"]').boundingBox();
    await page.mouse.move(
      perspective!.x + perspective!.width / 2,
      perspective!.y + perspective!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(side!.x + side!.width / 2, side!.y + side!.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(
      await page.evaluate(() => window.threeDemo.cameras.get('front')!.position.toArray()),
    ).toEqual(frontPose);
    const disposedAssets = await page.evaluate(() => {
      let count = 0;
      window.threeDemo.session.scene.traverse((object) => {
        const mesh = object as import('three').Mesh;
        mesh.geometry?.addEventListener('dispose', () => count++);
      });
      window.threeDemo.workspace.dispose();
      window.threeDemo.session.dispose();
      return count;
    });
    expect(disposedAssets).toBe(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: Three workspace retains cameras and renders only other camera helpers`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html`);
    await page.getByRole('button', { name: '4 view', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.threeDemo.session.scene.children.filter(
              (object) => object.userData.cameraRay === true,
            ).length,
        ),
      )
      .toBe(4);
    await expect(page.getByRole('tab', { name: 'Theming', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Inspector', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toBeVisible();
    for (const name of ['Perspective', 'Top', 'Front', 'Side']) {
      await expect(page.getByRole('tab', { name, exact: true }).locator('svg')).toHaveCount(1);
    }
    expect(
      await page.evaluate(() => {
        const { session, cameras } = window.threeDemo;
        const blocks: number[][] = [];
        session.scene.traverse((object) => {
          if (object.name === 'Study block') {
            const parameters = (object as import('three').Mesh<import('three').BoxGeometry>)
              .geometry.parameters;
            blocks.push([parameters.width, parameters.height, parameters.depth]);
          }
        });
        return {
          blocks,
          far: ['perspective', 'top', 'front', 'side']
            .map((id) => cameras.get(id)!)
            .map((camera) => (camera as import('three').PerspectiveCamera).far),
        };
      }),
    ).toEqual({
      blocks: [
        [1, 1.05, 2],
        [1.55, 1.55, 0.8],
        [1.55, 0.65, 1],
      ],
      far: [50, 8, 8, 8],
    });
    await page.screenshot({ path: `artifacts/four-view-${framework}.png` });
    const draws = await page.evaluate(() => {
      const { session, cameras } = window.threeDemo;
      const drawn: Record<string, string[]> = {};
      const restore: (() => void)[] = [];
      session.scene.traverse((object) => {
        if (object.userData.cameraRay !== true) return;
        const original = object.onBeforeRender;
        object.onBeforeRender = function (...args) {
          original.apply(this, args);
          const id = [...cameras].find(([, camera]) => camera === args[2])?.[0] ?? 'unknown';
          (drawn[id] ??= []).push(object.name);
        };
        restore.push(() => {
          object.onBeforeRender = original;
        });
      });
      session.render(performance.now());
      restore.forEach((fn) => fn());
      return drawn;
    });
    for (const id of ['perspective', 'top', 'front', 'side']) {
      expect(draws[id]).toHaveLength(3);
      expect(draws[id]).not.toContain(`camera-helper-${id}`);
    }
    const before = await page.evaluate(() => {
      const camera = window.threeDemo.cameras.get('front')!;
      camera.position.x += 1;
      window.threeDemo.session.invalidate();
      return { pose: camera.position.toArray(), mounts: window.threeDemo.counters?.mounts };
    });
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(1);
    await page.getByRole('button', { name: '4 view', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(4);
    const after = await page.evaluate(() =>
      window.threeDemo.cameras.get('front')!.position.toArray(),
    );
    after.forEach((value, index) => expect(value).toBeCloseTo(before.pose[index]!, 10));
    expect(await page.evaluate(() => window.threeDemo.counters?.mounts)).toBe(before.mounts);
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: four-view chrome and right-click menus use ordinary Quilt actions`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html?workspace=three`);
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    await expect(
      page.getByRole('button', { name: /^(Overlay action|Pop out|Rotate scene)$/ }),
    ).toHaveCount(0);
    for (const [id, title] of [
      ['perspective', 'Perspective'],
      ['top', 'Top'],
      ['front', 'Front'],
      ['side', 'Side'],
    ] as const) {
      await page.getByRole('button', { name: `${title} actions`, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await page
        .locator(`[data-pane-id="${id}"] [data-quilt-three-input]`)
        .click({ button: 'right' });
      await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await page.screenshot({ path: `artifacts/four-view-${framework}.png` });
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: custom views configure rows and columns and retain camera state`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html`);
    await page.getByRole('button', { name: 'Custom views', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    const configure = async (rows: number, columns: number) => {
      await page.getByRole('spinbutton', { name: 'Rows', exact: true }).fill(String(rows));
      await page.getByRole('spinbutton', { name: 'Columns', exact: true }).fill(String(columns));
      await page.getByRole('button', { name: 'Apply grid', exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => window.threeDemo.session.stats.views))
        .toBe(rows * columns);
    };
    await configure(2, 3);
    expect(
      await page.evaluate(() => {
        const { session, cameras } = window.threeDemo;
        const helpers: import('three').Object3D[] = [];
        session.scene.traverse((object) => {
          if (object.userData.cameraRay === true) helpers.push(object);
        });
        return [...cameras]
          .filter(([id]) => id.startsWith('custom-view-'))
          .every(([, camera]) => helpers.every((helper) => !camera.layers.test(helper.layers)));
      }),
    ).toBe(true);
    await expect(page.locator('[data-node-id="inspector-group"]')).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Rows', exact: true })).not.toHaveAttribute(
      'max',
    );
    await expect(
      page.getByRole('spinbutton', { name: 'Columns', exact: true }),
    ).not.toHaveAttribute('max');
    await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(1);
    const pose = await page.evaluate(() => {
      const camera = window.threeDemo.cameras.get('custom-view-1-2')!;
      camera.position.x += 0.5;
      window.threeDemo.session.invalidate();
      return camera.position.toArray();
    });
    await configure(1, 1);
    await configure(2, 3);
    const restored = await page.evaluate(() =>
      window.threeDemo.cameras.get('custom-view-1-2')!.position.toArray(),
    );
    restored.forEach((value, index) => expect(value).toBeCloseTo(pose[index]!, 8));
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await page.getByRole('button', { name: 'Custom views', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.threeDemo.session.stats.views)).toBe(6);
    await expect(page.getByRole('spinbutton', { name: 'Columns', exact: true })).toHaveValue('3');
    await page.getByRole('spinbutton', { name: 'Rows', exact: true }).fill('0');
    await page.getByRole('button', { name: 'Apply grid', exact: true }).click();
    expect(await page.evaluate(() => window.threeDemo.session.stats.views)).toBe(6);
    await configure(3, 10);
    await configure(5, 2);
    await configure(2, 3);
    await page.getByRole('button', { name: 'View 1.1 actions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.locator('[data-node-id="group-custom-view-0-0"] .layouts-tab-label'),
    ).toBeHidden();
    await page
      .locator('[data-pane-id="custom-view-0-0"] [data-quilt-three-input]')
      .click({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `artifacts/custom-views-${framework}.png` });
  });
}

test('camera rays stop at the nearest mesh or their maximum length', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Requires WebGL');
  await page.goto('/vanilla.html?workspace=three');
  await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
  const rays = await page.evaluate(() => {
    const { session, cameras } = window.threeDemo;
    const read = () => {
      session.render(performance.now());
      const helper = session.scene.getObjectByName('camera-helper-front')! as import('three').Line;
      const positions = helper.geometry.getAttribute('position');
      return {
        count: positions.count,
        start: [positions.getX(0), positions.getY(0), positions.getZ(0)],
        end: [positions.getX(1), positions.getY(1), positions.getZ(1)],
      };
    };
    const hit = read();
    const model = session.scene.getObjectByName('model')!;
    session.scene.remove(model);
    const miss = read();
    session.scene.add(model);
    return {
      hit,
      miss,
      origin: cameras.get('front')!.position.toArray(),
      helpers: session.scene.children.filter((object) => object.type === 'CameraHelper').length,
    };
  });
  expect(rays.helpers).toBe(0);
  expect(rays.hit.count).toBe(2);
  rays.hit.start.forEach((value, i) => expect(value).toBeCloseTo(rays.origin[i]!, 5));
  // The center ray meets the tall study block's front face at z = -0.575.
  expect(rays.hit.end[2]).toBeCloseTo(-0.575, 5);
  const length = (ray: typeof rays.hit) =>
    Math.hypot(...ray.end.map((value, index) => value - ray.start[index]!));
  expect(length(rays.hit)).toBeLessThan(10);
  expect(length(rays.miss)).toBeCloseTo(10, 5);
});
