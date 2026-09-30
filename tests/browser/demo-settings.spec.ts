import { expect, test } from '@playwright/test';
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: settings are primary and interaction rules work live`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const panel = page.getByRole('tabpanel', { name: 'Settings', exact: true });
    const heading = await panel.getByRole('heading', { name: 'Workspace settings' }).boundingBox();
    const header = await page
      .locator('[data-node-id="tools-group"] > .layouts-header')
      .boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    await panel.getByLabel('Move tabs between panes', { exact: true }).selectOption('false');
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).toHaveAttribute(
      'draggable',
      'false',
    );
    await panel.getByLabel('Reorder tabs', { exact: true }).selectOption('true');
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).toHaveAttribute(
      'draggable',
      'true',
    );
    await panel.getByLabel('Settings scope').selectOption('pane');
    await panel.getByLabel('Apply to').selectOption('canvas');
    await panel.getByLabel('Close tabs and panes').selectOption('false');
    await expect(page.getByRole('button', { name: 'Close Scene', exact: true })).toHaveCount(0);
    await panel.getByLabel('Close tabs and panes').selectOption('true');
    await panel.getByLabel('Minimum width (px)').fill('320');
    await panel.getByLabel('Minimum width (px)').press('Tab');
    await expect(panel.getByLabel('Minimum width (px)')).toHaveValue('320');
    await panel.getByLabel('Maximum width (px)').fill('200');
    await panel.getByLabel('Maximum width (px)').press('Tab');
    await expect(panel.getByRole('status')).toHaveText('Minimum size cannot exceed maximum size.');
    await panel.getByLabel('Maximum width (px)').fill('');
    await panel.getByLabel('Maximum width (px)').press('Tab');
    await panel.getByLabel('Confirm before closing this tab').check();
    await page.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Close active tab', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Close selected panes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await panel.getByLabel('Auto collapse empty panes').selectOption('protected');
    await expect(page.getByLabel('Auto collapse', { exact: true })).toHaveCount(0);
    await panel.getByLabel('Allow popout windows').uncheck();
    await page.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await panel.getByLabel('Enable demo shortcuts').uncheck();
    await page.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Maximize region', exact: true }).locator('kbd'),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await panel.getByRole('button', { name: 'Reset interaction rules' }).click();
    await expect(panel.getByLabel('Auto collapse empty panes')).toHaveValue('disabled');
    await expect(panel.getByLabel('Enable demo shortcuts')).toBeChecked();
    await panel.getByLabel('Settings scope').selectOption('group');
    await panel.getByLabel('Apply to').selectOption('scene-group');
    await panel.getByLabel('Tab orientation override').selectOption('top');
    await expect(page.locator('[data-node-id="scene-group"]')).toHaveAttribute(
      'data-tab-placement',
      'top',
    );
    await panel.getByLabel('Tab display override').selectOption('automatic');
    await page.getByRole('tab', { name: 'Hotkeys', exact: true }).click();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect(panel.getByLabel('Apply to')).toHaveValue('scene-group');
    await panel.evaluate((element) => {
      element.scrollTop = 0;
    });
    if (framework === 'vanilla') await page.screenshot({ path: '/tmp/quilt-demo-settings.png' });
  });
}
