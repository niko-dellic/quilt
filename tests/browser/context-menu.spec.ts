import { expect, test } from '@playwright/test';

for (const placement of ['top', 'left'] as const) {
  test(`global context menu modes work live on ${placement} bars without remounting content`, async ({
    page,
  }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate((placement) => window.harness.setTabBar({ placement }), placement);
    const before = await page.evaluate(() => ({
      mounts: window.harness.stats.mounts,
      layout: window.harness.store.exportLayout(),
    }));
    const buttons = page.locator('.layouts-header > button[aria-haspopup="dialog"]');
    const bar = page.locator('[data-node-id="right"] > .layouts-header');
    const dialog = page.locator('dialog.layouts-menu');
    await expect(buttons).toHaveCount(2);
    await bar.click({ button: 'right' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    for (const mode of ['right-click', 'both', 'none', 'button'] as const) {
      await page.evaluate(
        (contextMenu) => window.harness.mounted.updateOptions({ contextMenu }),
        mode,
      );
      await expect(buttons).toHaveCount(mode === 'button' || mode === 'both' ? 2 : 0);
      const prevented = await bar.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return !node.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 5,
            clientY: rect.top + 5,
          }),
        );
      });
      expect(prevented).toBe(mode === 'right-click' || mode === 'both');
      if (prevented) {
        await expect(dialog).toHaveAttribute('aria-label', 'B actions');
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      } else {
        await expect(dialog).toHaveCount(0);
      }
      if (mode === 'both' || mode === 'button') {
        await page.getByRole('button', { name: 'B actions', exact: true }).click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
    expect(
      await page.evaluate(() => ({
        mounts: window.harness.stats.mounts,
        layout: window.harness.store.exportLayout(),
      })),
    ).toEqual(before);
    await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'both' }));
    expect(
      await page
        .locator('[role="tabpanel"]')
        .first()
        .evaluate(
          (node) =>
            !node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
        ),
    ).toBe(false);
    await page.getByRole('tab', { name: 'B', exact: true }).click({ button: 'right' });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'none' }));
    await expect(dialog).toHaveCount(0);
    await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: undefined }));
    await expect(buttons).toHaveCount(2);
    await bar.click({ button: 'right' });
    await expect(dialog).toBeVisible();
  });
}

test('empty regions expose the same right-click menu and respect none', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.store.closePane('a', { force: true });
    window.harness.mounted.updateOptions({ contextMenu: 'right-click' });
  });
  const bar = page.locator('[data-node-id="left"] > .layouts-header');
  await expect(bar.getByRole('button', { name: 'Empty pane actions', exact: true })).toHaveCount(0);
  await bar.click({ button: 'right' });
  const dialog = page.getByRole('dialog', { name: 'Empty pane actions', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close empty pane', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'none' }));
  await bar.dispatchEvent('contextmenu');
  await expect(dialog).toHaveCount(0);
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: workspace setting offers all menu modes`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const setting = page
      .getByRole('region', { name: 'Tab', exact: true })
      .getByLabel('Pane context menu', { exact: true });
    const buttons = page.locator('.layouts-header > button[aria-haspopup="dialog"]');
    await expect(setting).toHaveValue('both');
    await expect(setting.locator('option:checked')).toHaveText('Integrated and right-click');
    for (const mode of ['right-click', 'both', 'none', 'button']) {
      await setting.selectOption(mode);
      if (mode === 'right-click' || mode === 'none') await expect(buttons).toHaveCount(0);
      else
        await expect(
          page.getByRole('button', { name: 'Settings actions', exact: true }),
        ).toBeVisible();
    }
  });
}

for (const entry of ['right-click', 'integrated'] as const) {
  test(`repeated right-click repositions an open ${entry} menu and suppresses native menus`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/tests/browser/harness.html');
    if (entry === 'integrated')
      await page.getByRole('button', { name: 'B actions', exact: true }).click();
    else await page.getByRole('tab', { name: 'B', exact: true }).click({ button: 'right' });
    const dialog = page.getByRole('dialog', { name: 'B actions', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((node) => {
      node.setAttribute('data-original-menu', 'true');
      node.addEventListener(
        'contextmenu',
        (event) => {
          node.setAttribute('data-context-prevented', String(event.defaultPrevented));
        },
        { capture: true },
      );
    });
    // This click lands on the modal backdrop, where tab-bar listeners cannot see it.
    await page.mouse.click(50, 80, { button: 'right' });
    await expect(dialog).toHaveAttribute('data-context-prevented', 'true');
    await expect(dialog).toHaveAttribute('data-original-menu', 'true');
    let bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeCloseTo(50, 0);
    expect(bounds.y).toBeCloseTo(80, 0);
    // Right-clicking inside the menu also moves the same dialog.
    await page.mouse.click(bounds.x + 20, bounds.y + 20, { button: 'right' });
    bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeCloseTo(70, 0);
    expect(bounds.y).toBeCloseTo(100, 0);
    await expect(page.locator('dialog.layouts-menu')).toHaveCount(1);
    // Repositioning retains viewport clamping.
    await page.mouse.click(1195, 895, { button: 'right' });
    bounds = (await dialog.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1192);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(892);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(
      await page
        .locator('[role="tabpanel"]')
        .first()
        .evaluate((node) =>
          node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
        ),
    ).toBe(true);
  });
}

test('integrated icon updates globally, including empty regions, without remounting panes', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => window.harness.store.closePane('a', { force: true }));
  const buttons = page.locator('.layouts-header > button[aria-haspopup="dialog"]');
  const circles = buttons.locator('svg circle');
  const before = await page.evaluate(() => ({
    mounts: window.harness.stats.mounts,
    layout: window.harness.store.exportLayout(),
  }));
  await expect(buttons).toHaveCount(2);
  await expect(circles).toHaveCount(6);
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenuIcon: 'one-dot' }));
  await expect(circles).toHaveCount(2);
  await page.getByRole('button', { name: 'Empty pane actions', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Empty pane actions', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'B actions', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'B actions', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenuIcon: undefined }));
  await expect(circles).toHaveCount(6);
  expect(
    await page.evaluate(() => ({
      mounts: window.harness.stats.mounts,
      layout: window.harness.store.exportLayout(),
    })),
  ).toEqual(before);
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: Tab settings select integrated button appearance`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const setting = page
      .getByRole('region', { name: 'Tab', exact: true })
      .getByLabel('Integrated button appearance', { exact: true });
    const button = page.getByRole('button', { name: 'Settings actions', exact: true });
    await expect(setting).toHaveValue('three-dots');
    await expect(button.locator('circle')).toHaveCount(3);
    await setting.selectOption('one-dot');
    await expect(button.locator('circle')).toHaveCount(1);
    await setting.selectOption('three-dots');
    await expect(button.locator('circle')).toHaveCount(3);
  });
}
