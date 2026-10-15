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
    await page
      .locator('[data-node-id="scene-group"] [data-corner="tl"]')
      .click({ button: 'right' });
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

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: right-drag pans without opening the pane menu`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html?workspace=three`);
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    const input = page.locator('[data-pane-id="perspective"] [data-quilt-three-input]');
    const box = (await input.boundingBox())!;
    // Native browser menus are outside the DOM: assert cancellation of the actual
    // event, rather than only checking that Quilt's menu is absent.
    expect(
      await input.evaluate((element) => {
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: 100,
          clientY: 100,
        });
        return { dispatched: element.dispatchEvent(event), prevented: event.defaultPrevented };
      }),
    ).toEqual({ dispatched: false, prevented: true });

    const pose = () =>
      page.evaluate(() => {
        for (let i = 0; i < 160; i++) window.threeDemo.session.render(performance.now());
        const camera = window.threeDemo.cameras.get('perspective')!;
        return { position: camera.position.toArray(), rotation: camera.quaternion.toArray() };
      });
    const before = await pose();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
    await page.mouse.down({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeHidden();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeHidden();
    const after = await pose();
    expect(after.position).not.toEqual(before.position);
    after.rotation.forEach((value, index) => expect(value).toBeCloseTo(before.rotation[index]!, 8));
    await input.click({ button: 'right', position: { x: box.width * 0.5, y: box.height * 0.6 } });
    await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeHidden();
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: synchronized camera positions preserve independent orientation and zoom`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html?workspace=three`);
    await expect.poll(() => page.evaluate(() => window.threeDemo?.session?.stats.views)).toBe(4);
    const poses = () =>
      page.evaluate(() => {
        for (let i = 0; i < 160; i++) window.threeDemo.session.render(performance.now());
        return window.threeDemo.session.getViews().map((view) => ({
          id: view.camera.name,
          position: view.camera.position.toArray(),
          rotation: view.camera.quaternion.toArray(),
          zoom: (view.camera as import('three').PerspectiveCamera).zoom,
        }));
      });
    for (const mode of ['four', 'custom']) {
      if (mode === 'custom')
        await page.getByRole('button', { name: 'Custom views', exact: true }).click();
      const id = mode === 'four' ? 'perspective' : 'custom-view-0-0';
      const toggle =
        mode === 'four'
          ? page
              .locator(`[data-pane-id="${id}"]`)
              .getByRole('button', { name: 'Sync camera positions', exact: true })
          : page
              .locator('.demo-view-controls')
              .getByRole('button', { name: 'Sync camera positions', exact: true });
      const helperButtons = page.getByRole('button', {
        name: mode === 'four' ? 'Camera helper' : 'Camera helpers',
        exact: true,
      });
      if (mode === 'custom') await helperButtons.click();
      const before = await poses();
      const source = before.find((pose) => pose.id === id)!;
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      for (const button of await helperButtons.all()) {
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute('aria-pressed', 'false');
      }
      expect(
        await page.evaluate(() => {
          const { session } = window.threeDemo;
          let draws = 0;
          const restore: (() => void)[] = [];
          session.scene.traverse((object) => {
            if (!object.userData.cameraRay) return;
            const original = object.onBeforeRender;
            object.onBeforeRender = () => {
              draws++;
            };
            restore.push(() => {
              object.onBeforeRender = original;
            });
          });
          session.render(performance.now());
          restore.forEach((fn) => fn());
          return draws;
        }),
      ).toBe(0);

      for (const pose of await poses()) {
        pose.position.forEach((value, i) => expect(value).toBeCloseTo(source.position[i]!, 8));
        const original = before.find((item) => item.id === pose.id)!;
        pose.rotation.forEach((value, i) => expect(value).toBeCloseTo(original.rotation[i]!, 8));
        expect(pose.zoom).toBe(original.zoom);
      }
      const input = page.locator(`[data-pane-id="${id}"] [data-quilt-three-input]`);
      const box = (await input.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, { steps: 6 });
      await page.mouse.up({ button: 'right' });
      const moved = await poses();
      const leader = moved.find((pose) => pose.id === id)!;
      expect(leader.position).not.toEqual(source.position);
      for (const pose of moved) {
        pose.position.forEach((value, i) => expect(value).toBeCloseTo(leader.position[i]!, 8));
        const original = before.find((item) => item.id === pose.id)!;
        pose.rotation.forEach((value, i) => expect(value).toBeCloseTo(original.rotation[i]!, 8));
      }
      await toggle.click();
      for (const button of await helperButtons.all()) {
        await expect(button).toBeEnabled();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
      }

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, { steps: 6 });
      await page.mouse.up({ button: 'right' });
      for (const pose of (await poses()).filter((item) => item.id !== id)) {
        const original = moved.find((item) => item.id === pose.id)!;
        pose.position.forEach((value, i) => expect(value).toBeCloseTo(original.position[i]!, 8));
      }
    }
  });
}

for (const framework of ['vanilla', 'react']) {
  for (const [workspace, id] of [
    ['three', 'top'],
    ['custom', 'custom-view-0-1'],
  ] as const) {
    test(`${framework}: ${workspace} top view orbits around world Y`, async ({ page }) => {
      await page.goto(`/${framework}.html?workspace=${workspace}`);
      const input = page.locator(`[data-pane-id="${id}"] [data-quilt-three-input]`);
      await expect(input).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => window.threeDemo?.session?.stats.drawCalls))
        .toBeGreaterThan(0);
      const pose = () =>
        page.evaluate((id) => {
          const camera = window.threeDemo.cameras.get(id)!;
          return { position: camera.position.toArray(), up: camera.up.toArray() };
        }, id);
      const settle = () =>
        page.evaluate(() => {
          for (let i = 0; i < 180; i++) window.threeDemo.session.render(performance.now());
        });
      const initial = await pose();
      expect(initial.up).toEqual([0, 1, 0]);
      expect(initial.position[1]).toBeCloseTo(5, 4);
      const box = (await input.boundingBox())!;
      const x = box.x + box.width * 0.5;
      const y = box.y + box.height * 0.5;
      const tiltedY = y - box.height * 0.1;
      // Move away from the top pole, then orbit horizontally: height should
      // remain constant while the camera moves around the world's Y axis.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, tiltedY, { steps: 8 });
      await page.mouse.up();
      await settle();
      const tilted = await pose();
      expect(tilted.position[1]).toBeLessThan(initial.position[1]! - 0.1);
      await page.mouse.down();
      await page.mouse.move(x + box.width * 0.1, tiltedY, { steps: 8 });
      await page.mouse.up();
      await settle();
      const orbited = await pose();
      expect(orbited.position[1]).toBeCloseTo(tilted.position[1]!, 5);
      expect(Math.abs(orbited.position[0]! - tilted.position[0]!)).toBeGreaterThan(0.1);
      await input.dblclick();
      await settle();
      const reset = await pose();
      reset.position.forEach((value, index) =>
        expect(value).toBeCloseTo(initial.position[index]!, 4),
      );
      expect(reset.up).toEqual([0, 1, 0]);
    });
  }
}
