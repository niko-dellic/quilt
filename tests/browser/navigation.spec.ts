import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: free navigation owns hovered inputs and returns to Orbit`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html?workspace=three`);
    const pane = page.locator('[data-pane-id="perspective"]');
    const input = pane.locator('[data-quilt-three-input]');
    await expect(input).toBeVisible();
    const pose = (id = 'perspective') =>
      page.evaluate((id) => {
        const c = window.threeDemo.cameras.get(id)!;
        return {
          p: c.position.toArray().map((value) => Math.round(value * 1e10) / 1e10),
          q: c.quaternion.toArray().map((value) => Math.round(value * 1e10) / 1e10),
        };
      }, id);
    const initial = await pose();
    await input.hover();
    await page.keyboard.down('w');
    await expect(pane.locator('.demo-free-navigation')).toBeVisible();
    await expect.poll(pose).not.toEqual(initial);
    await page.keyboard.up('w');
    await page.keyboard.press('Escape');
    await expect(pane.locator('.demo-free-navigation')).toBeHidden();
    const stopped = await pose();
    // Follow retains orientation while preserving the distance travelled.
    expect(stopped.p).not.toEqual(initial.p);
    expect(stopped.q).toEqual(initial.q);
    await page.waitForTimeout(150);
    expect(await pose()).toEqual(stopped);
    await page.keyboard.down('w');
    const top = page.locator('[data-pane-id="top"] [data-quilt-three-input]');
    await top.hover();
    const left = await pose();
    const topInitial = await pose('top');
    await page.keyboard.down('w'); // Repeat must not transfer the key to the new viewport.
    await page.waitForTimeout(100);
    expect(await pose()).toEqual(left);
    expect(await pose('top')).toEqual(topInitial);
    await page.keyboard.up('w');
    await page.keyboard.down('w');
    await expect.poll(() => pose('top')).not.toEqual(topInitial);
    await page.keyboard.up('w');
    await page.keyboard.press('Escape');
    await input.hover();
    await page.keyboard.press('w');
    const beforeLook = await pose();
    const box = (await input.boundingBox())!;
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    expect((await pose()).q).not.toEqual(beforeLook.q);
    await page.mouse.down();
    await expect(pane.locator('.demo-free-navigation')).toBeHidden();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55, { steps: 3 });
    await page.mouse.up();
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: free mode survives companion return and synchronizes positions`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html`);
    const input = page.locator('[data-pane-id="canvas"] [data-quilt-three-input]');
    await input.hover();
    await page.keyboard.press('w');
    await expect(page.locator('.demo-free-navigation')).toBeVisible();
    await page
      .locator('[data-node-id="scene-group"] [data-corner="tl"]')
      .click({ button: 'right' });
    const popupEvent = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open in window', exact: true }).click();
    const popup = await popupEvent;
    await expect(popup.locator('.demo-free-navigation')).toBeVisible();
    await popup.close();
    await expect(page.locator('.demo-free-navigation')).toBeVisible();
    await page.getByRole('button', { name: '4 view', exact: true }).click();
    const pane = page.locator('[data-pane-id="perspective"]');
    await pane.getByRole('button', { name: 'Sync camera positions', exact: true }).click();
    await pane.locator('[data-quilt-three-input]').hover();
    await page.keyboard.down('w');
    await expect(pane.locator('.demo-free-navigation')).toBeVisible();
    await page.waitForTimeout(200);
    await page.keyboard.up('w');
    await page.keyboard.press('Escape');
    const positions = await page.evaluate(() =>
      window.threeDemo.session.getViews().map((v) => v.camera.position.toArray()),
    );
    for (const position of positions)
      position.forEach((value, i) => expect(value).toBeCloseTo(positions[0]![i]!, 8));
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: settings switches orbit target policy on existing views`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Requires WebGL');
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Hotkeys', exact: true }).click();
    await expect(page.getByText('Resize divider', { exact: true })).toHaveCount(0);
    await expect(page.getByText('WASD / Arrow keys', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    const policy = page.getByRole('combobox', { name: 'Orbit target', exact: true });
    await expect(policy).toHaveValue('follow');
    await expect(policy.locator('option')).toHaveText([
      'Follow navigation',
      'Preserve orbit point',
    ]);
    const input = page.locator('[data-pane-id="canvas"] [data-quilt-three-input]');
    const pose = () =>
      page.evaluate(() => {
        const c = window.threeDemo.cameras.get('canvas')!;
        return { position: c.position.toArray(), rotation: c.quaternion.toArray() };
      });
    const original = await pose();
    await input.hover();
    await page.keyboard.down('d');
    await expect.poll(pose).not.toEqual(original);
    await page.keyboard.up('d');
    // Changing policy during Free navigation applies without remounting the camera.
    await policy.selectOption('preserve');
    await input.hover();
    await page.keyboard.press('Escape');
    const restored = await pose();
    expect(restored.rotation).not.toEqual(original.rotation);
    expect(
      await page.evaluate(() => {
        const c = window.threeDemo.cameras.get('canvas')!;
        return c.getWorldDirection(c.position.clone()).dot(c.position.clone().negate().normalize());
      }),
    ).toBeCloseTo(1, 8);
    await policy.selectOption('follow');
    await input.hover();
    await page.keyboard.down('d');
    await expect.poll(pose).not.toEqual(restored);
    await page.keyboard.up('d');
    await page.keyboard.press('Escape');
    (await pose()).rotation.forEach((v, i) => expect(v).toBeCloseTo(restored.rotation[i]!, 8));
    await policy.selectOption('preserve');
    await page.getByRole('button', { name: '4 view', exact: true }).click();
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect(policy).toHaveValue('preserve');
  });
}
