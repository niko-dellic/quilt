import { test, expect } from '@playwright/test';

test('dedication preserves the active view and geometry, restores elsewhere, and releases', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    w.movePane('b', 'left');
    w.activatePane('a');
  });
  const region = page.locator('[data-node-id="left"]');
  const before = await region.boundingBox();
  const active = await region.getByRole('textbox', { name: 'A', exact: true }).elementHandle();
  const mounts = await page.evaluate(() => window.harness.stats.mounts);
  await region.getByRole('button', { name: 'A actions', exact: true }).click();
  await page.getByRole('button', { name: 'Pin active tab', exact: true }).click();
  await expect(region).toHaveAttribute('data-dedicated', '');
  await expect(region.getByRole('tab')).toHaveCount(0);
  expect(await region.boundingBox()).toEqual(before);
  expect(await active!.evaluate((el) => el.isConnected)).toBe(true);
  expect(await page.evaluate(() => window.harness.stats.mounts)).toBe(mounts);
  await expect(region.getByRole('button', { name: 'A actions', exact: true })).toHaveCount(0);
  const button = region.locator('[data-corner="tl"]');
  await button.click({ button: 'right' });
  await expect(page.getByRole('button', { name: 'Unpin tab', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore closed tab', exact: true }).click();
  await expect(
    page.locator('[data-node-id="right"]').getByRole('tab', { name: 'B', exact: true }),
  ).toBeVisible();
  await button.click({ button: 'right' });
  await page.getByRole('button', { name: 'Unpin tab', exact: true }).click();
  await expect(region.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
});

test('dedication cancellation, stale confirmation, and permissions are atomic', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(async () => {
    const w = window.harness.mounted;
    w.movePane('b', 'left');
    w.activatePane('a');
    const layout = w.exportLayout();
    layout.panes.b!.confirmClose = true;
    w.loadLayout(layout);
    w.updateOptions({ confirmClose: () => false });
    const cancelled = await w.dedicateGroup('left');
    const afterCancel = w.exportLayout();
    let answer!: (value: boolean) => void;
    w.updateOptions({
      confirmClose: () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    });
    const pending = w.dedicateGroup('left');
    w.activatePane('b');
    answer(true);
    const stale = await pending;
    w.activatePane('a');
    w.updateOptions({ capabilities: { panes: { b: { close: false } } } });
    const denied = await w.dedicateGroup('left');
    return { cancelled, stale, denied, afterCancel, original: layout, final: w.exportLayout() };
  });
  expect(result.cancelled).toBe(false);
  expect(result.stale).toBe(false);
  expect(result.denied).toBe(false);
  expect(result.afterCancel).toEqual(result.original);
  expect(result.final).toEqual(result.original);
});

for (const demo of ['vanilla', 'react']) {
  test(`${demo}: default canvas is dedicated and releases through its corner menu`, async ({
    page,
  }) => {
    await page.goto(`/${demo}.html`);
    const scene = page.locator('[data-node-id="scene-group"]');
    await expect(scene).toHaveAttribute('data-dedicated', '');
    await expect(scene.getByRole('tab')).toHaveCount(0);
    const region = await scene.boundingBox();
    const content = await scene.locator('.layouts-body').boundingBox();
    expect(Math.abs(content!.y - region!.y)).toBeLessThan(2);
    expect(Math.abs(content!.x - region!.x)).toBeLessThan(2);
    await expect(scene.getByRole('button', { name: 'Scene actions', exact: true })).toHaveCount(0);
    await scene.locator('[data-corner="tl"]').click({ button: 'right' });
    await page.getByRole('button', { name: 'Unpin tab', exact: true }).click();
    await expect(scene.getByRole('tab', { name: 'Scene', exact: true })).toBeVisible();
  });
}

test('dedicated popout reserves its source and returns without admitting other tabs', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => window.harness.mounted.dedicateGroup('left'));
  const popupEvent = page.waitForEvent('popup');
  await page.locator('#open').click();
  const popup = await popupEvent;
  await expect(popup.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
  const region = page.locator('[data-node-id="left"]');
  await expect(region).toHaveAttribute('data-dedicated', '');
  expect(await page.evaluate(() => window.harness.mounted.canNode('left', 'addTab'))).toBe(false);
  await popup.close();
  await expect(region.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
  await expect(region.getByRole('tab')).toHaveCount(0);
});

test('dedicated chrome overrides tab styling, respects menu settings, and preserves hidden headers', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    w.setTabBar({ placement: 'left', attachment: 'floating', fit: 'fit' });
  });
  await page.evaluate(() => window.harness.mounted.dedicateGroup('left'));
  const region = page.locator('[data-node-id="left"]');
  await expect(region).toHaveAttribute('data-tab-placement', 'top');
  await expect(region.locator(':scope > header')).toBeHidden();
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'right-click' }));
  await expect(region.getByRole('button', { name: 'A actions', exact: true })).toHaveCount(0);
  await expect(region).toHaveCSS('--layouts-tab-bar-width', '0px');
  await expect(region).toHaveCSS('--layouts-tab-bar-height', '0px');
  await region.locator('.layouts-body').dispatchEvent('contextmenu');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'both' }));
  await region.locator('[data-corner="tl"]').click({ button: 'right' });
  await expect(page.getByRole('button', { name: 'Unpin tab', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    const layout = w.exportLayout();
    layout.panes.a!.header = false;
    w.loadLayout(layout);
    w.releaseGroup('left');
  });
  await expect(region.locator(':scope > header')).toBeHidden();
});

test('pinned regions reject tab drops while enabling joins', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => window.harness.mounted.dedicateGroup('left'));
  const before = await page.evaluate(() => window.harness.mounted.exportLayout());
  const left = page.locator('[data-node-id="left"]');
  const right = page.locator('[data-node-id="right"]');
  await left.locator('[data-corner="tl"]').click({ button: 'right' });
  await expect(
    page.getByRole('button', { name: 'Join sibling region', exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Escape');
  const box = (await left.boundingBox())!;
  await right
    .getByRole('tab', { name: 'B', exact: true })
    .dragTo(left, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
  expect(await page.evaluate(() => window.harness.mounted.exportLayout())).toEqual(before);
});

test('two pinned regions merge through a corner gesture without remounting views', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(async () => {
    await window.harness.mounted.dedicateGroup('left');
    await window.harness.mounted.dedicateGroup('right');
  });
  const left = page.locator('[data-node-id="left"]');
  const right = page.locator('[data-node-id="right"]');
  const box = (await left.boundingBox())!;
  const mounts = await page.evaluate(() => window.harness.stats.mounts);
  await right.locator('[data-corner="tl"]').hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 30);
  await expect(page.locator('[data-corner-preview="join"]')).toBeVisible();
  await page.mouse.up();
  await expect(right.getByRole('tab')).toHaveCount(2);
  await expect(right).not.toHaveAttribute('data-dedicated');
  await expect(left).toHaveCount(0);
  expect(await page.evaluate(() => window.harness.stats.mounts)).toBe(mounts);
});

test('confirmation names only inactive tabs and commits once; disposal cancels pending dedication', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    w.movePane('b', 'left');
    w.activatePane('a');
    const layout = w.exportLayout();
    layout.panes.b!.confirmClose = true;
    layout.panes.a!.confirmClose = true;
    w.loadLayout(layout);
  });
  await page
    .locator('[data-node-id="left"]')
    .getByRole('button', { name: 'A actions', exact: true })
    .click();
  await page.getByRole('button', { name: 'Pin active tab', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Close selected panes?', exact: true });
  await expect(dialog.locator('p')).toHaveText('B');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('[data-node-id="left"]')).toHaveAttribute('data-dedicated', '');
  expect(await page.evaluate(() => window.harness.mounted.canRestoreClosedPane())).toBe(true);
  expect(
    await page.evaluate(async () => {
      const w = window.harness.mounted;
      w.releaseGroup('left');
      w.restoreClosedPane();
      w.activatePane('a');
      w.updateOptions({ confirmClose: () => new Promise<boolean>(() => {}) });
      const pending = w.dedicateGroup('left');
      w.dispose();
      return pending;
    }),
  ).toBe(false);
});

for (const demo of ['vanilla', 'react']) {
  test(`${demo}: pinning hides menu chrome and removes its content clearance`, async ({ page }) => {
    await page.goto(`/${demo}.html`);
    const region = page.locator('[data-node-id="tools-group"]');
    const heading = region.getByRole('heading', { name: 'Workspace settings', exact: true });
    const before = (await heading.boundingBox())!.y;
    await region.getByRole('button', { name: 'Settings actions', exact: true }).click();
    await page.getByRole('button', { name: 'Pin active tab', exact: true }).click();
    await expect(region.locator(':scope > header')).toBeHidden();
    await expect(region.getByRole('button', { name: 'Settings actions', exact: true })).toHaveCount(
      0,
    );
    await expect(region).toHaveCSS('--layouts-tab-bar-height', '0px');
    await expect.poll(async () => (await heading.boundingBox())!.y).toBeLessThan(before - 20);
    await region.locator('[data-corner="tl"]').click({ button: 'right' });
    await page.getByRole('button', { name: 'Unpin tab', exact: true }).click();
    await expect(
      region.getByRole('button', { name: 'Settings actions', exact: true }),
    ).toBeVisible();
    await expect.poll(async () => (await heading.boundingBox())!.y).toBe(before);
  });
}
