import { test, expect } from '@playwright/test';
for (const mode of ['disabled', 'protected', 'enabled'] as const) {
  test(`${mode}: last-tab close and popout follow the selected policy`, async ({ page }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate((mode) => window.harness.store.setAutoCollapse(mode), mode);
    const left = page.locator('[data-node-id="left"]');
    const opened = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Pop out', exact: true }).click();
    const popup = await opened;
    if (mode === 'enabled') await expect(left).toHaveCount(0);
    else await expect(left.getByRole('button', { name: 'Close empty pane' })).toBeVisible();
    await popup.close();
    await expect(page.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
    if (mode !== 'enabled')
      await expect(left.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
    await page.evaluate(() => window.harness.store.loadLayout(window.harness.fixture));
    await page.getByRole('button', { name: 'Close A', exact: true }).click();
    if (mode === 'disabled') {
      await expect(left.getByRole('button', { name: 'Close empty pane' })).toBeVisible();
      await left.getByRole('button', { name: 'Close empty pane' }).click();
    }
    await expect(left).toHaveCount(0);
    await page.getByRole('button', { name: 'Close B', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close empty pane' })).toBeDisabled();
  });
}
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: pending regions survive while searches dismiss outside the pane`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const setting = page.getByRole('combobox', { name: 'Auto collapse', exact: true });
    await expect(setting).toHaveValue('disabled');
    const source = page.locator('[data-node-id="scene-group"]');
    const box = (await source.boundingBox())!;
    await source.locator('[data-corner="tl"]').hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 8);
    await page.mouse.up();
    const pickers = page.locator('.layouts-picker-persistent');
    await expect(pickers).toHaveCount(1);
    const first = pickers.first();
    const firstRegion = first.locator('..');
    const id = await firstRegion.getAttribute('data-node-id');
    await first.getByRole('combobox').fill('notes');
    await first.getByRole('combobox').press('Escape');
    await setting.focus();
    await expect(first.getByRole('combobox')).toHaveValue('notes');
    await page.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Split', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Split down', exact: true }).click();
    await expect(pickers).toHaveCount(1);
    await expect(page.locator(`[data-node-id="${id}"] .layouts-empty`)).toBeVisible();
    await pickers.last().locator('..').getByRole('button', { name: 'Close empty pane' }).click();
    await expect(pickers).toHaveCount(0);
    await page.locator(`[data-node-id="${id}"] .layouts-empty`).click();
    await first.getByRole('option', { name: 'Notes', exact: true }).click();
    await expect(pickers).toHaveCount(0);
    await expect(
      page.locator(`[data-node-id="${id}"]`).getByRole('tab', { name: 'Notes', exact: true }),
    ).toBeVisible();
    await setting.selectOption('protected');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(setting).toHaveValue('protected');
  });
}
test('pending picker subscriptions clean up on removal, selection, and disposal', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const { tabs } = window.harness;
    let live = 0;
    const original = tabs.subscribe.bind(tabs);
    tabs.subscribe = (listener) => {
      live++;
      const unsubscribe = original(listener);
      return () => {
        live--;
        unsubscribe();
      };
    };
    Object.assign(window, { pickerSubscriptions: () => live });
    tabs.register({
      id: 'new',
      title: 'New',
      create: () => ({ id: 'c', title: 'C', type: 'test' }),
    });
  });
  const openPicker = async () => {
    await page.getByRole('button', { name: 'A actions', exact: true }).click();
    await page.getByRole('button', { name: 'Split', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Split down', exact: true }).click();
    await expect(page.locator('.layouts-picker-persistent')).toBeVisible();
    expect(await page.evaluate('window.pickerSubscriptions()')).toBe(1);
  };
  await openPicker();
  await page.getByRole('button', { name: 'Close empty pane' }).click();
  expect(await page.evaluate('window.pickerSubscriptions()')).toBe(0);
  await openPicker();
  await page.getByRole('option', { name: 'New', exact: true }).click();
  expect(await page.evaluate('window.pickerSubscriptions()')).toBe(0);
  await openPicker();
  await page.evaluate(() => window.harness.dispose());
  expect(await page.evaluate('window.pickerSubscriptions()')).toBe(0);
  await expect(page.locator('.layouts-picker-persistent')).toHaveCount(0);
});
