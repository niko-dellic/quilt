import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: shared viewport orbits, zooms, cancels, resets, and retains its camera across windows`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'WebGL interactions are validated in Chromium');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/${framework}.html`);
    const input = page.locator('[data-pane-id="canvas"] [data-quilt-three-input]');
    await expect(input).toBeVisible();
    const cameraState = () =>
      page.evaluate(() => {
        const camera = window.threeDemo.cameras.get('canvas')! as import('three').PerspectiveCamera;
        return [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.zoom].map(
          (value) => Math.round(value * 1e8) / 1e8,
        );
      });
    const settle = () =>
      page.evaluate(() => {
        for (let i = 0; i < 160; i++) window.threeDemo.session.render(performance.now());
      });
    const initial = await cameraState();
    const box = (await input.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 75, y + 25, { steps: 8 });
    await page.mouse.up();
    await settle();
    await expect.poll(cameraState).not.toEqual(initial);
    const orbited = await cameraState();
    await page.mouse.wheel(0, -150);
    await settle();
    await expect.poll(cameraState).not.toEqual(orbited);
    const zoomed = await cameraState();
    await page.mouse.down();
    await page.mouse.move(x, y - 40, { steps: 5 });
    await expect.poll(cameraState).not.toEqual(zoomed);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await settle();
    await expect.poll(cameraState).toEqual(zoomed);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 5 });
    await page.mouse.up();
    const releasedPan = await cameraState();
    await settle();
    expect(await cameraState()).not.toEqual(releasedPan);
    await page.keyboard.up('Shift');
    await expect.poll(cameraState).not.toEqual(zoomed);
    const panned = await cameraState();
    await page.getByRole('button', { name: 'Scene actions', exact: true }).click();
    const popupEvent = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open in window', exact: true }).click();
    const popup = await popupEvent;
    await expect(popup.locator('[data-quilt-three-input]')).toBeVisible();
    await popup.close();
    await expect(input).toBeVisible();
    await expect.poll(cameraState).toEqual(panned);
    await input.dblclick();
    await expect.poll(cameraState).toEqual(initial);
    expect(errors).toEqual([]);
  });

  test(`${framework}: every preset reuses the same scene, resources, and controls`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html`);
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(1);
    const identity = await page.evaluate(() => {
      const scene = window.threeDemo.session.scene;
      const model = scene.getObjectByName('model')!;
      return { scene: scene.uuid, model: model.uuid, mounts: window.threeDemo.counters?.mounts };
    });
    for (const [preset, pane] of [
      ['Focus', 'canvas'],
      ['Review', 'canvas'],
      ['4 view', 'perspective'],
      ['Custom views', 'custom-view-0-0'],
      ['Default', 'canvas'],
    ] as const) {
      await page.getByRole('button', { name: preset, exact: true }).click();
      const input = page.locator(`[data-pane-id="${pane}"] [data-quilt-three-input]`);
      await expect(input).toBeVisible();
      expect(
        await page.evaluate(() => {
          const scene = window.threeDemo.session.scene;
          return {
            scene: scene.uuid,
            model: scene.getObjectByName('model')!.uuid,
            mounts: window.threeDemo.counters?.mounts,
          };
        }),
      ).toEqual(identity);
      const pose = () =>
        page.evaluate((id) => window.threeDemo.cameras.get(id)!.position.toArray(), pane);
      const before = await pose();
      const box = (await input.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down('Shift');
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 3 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await expect.poll(pose).not.toEqual(before);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2, { steps: 3 });
      await page.mouse.up();
      await expect.poll(pose).not.toEqual(before);
      await expect(page.locator('[data-quilt-three-canvas]')).toHaveCount(1);
      await expect(page.locator('canvas:not([data-quilt-three-canvas])')).toHaveCount(0);
    }
  });
}
