import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: workspace configurations retain edits and reset independently`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const switcher = page.getByRole('group', { name: 'Workspace configuration' });
    const select = (name: string) => switcher.getByRole('button', { name, exact: true }).click();
    await expect(switcher.getByRole('button', { name: 'Default', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('tab', { name: 'Objects', exact: true }).click();
    await select('Focus');
    await expect(switcher.getByRole('button', { name: 'Focus', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('[data-node-id="timeline-group"]')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await page.getByRole('textbox', { name: 'Working notes' }).fill('Retained across workspaces');
    await select('Review');
    await expect(page.getByRole('textbox', { name: 'Working notes' })).toHaveValue(
      'Retained across workspaces',
    );
    await expect(page.getByRole('tab', { name: 'Timeline', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('combobox', { name: 'Workspace theme' })).toBeVisible();
    await select('Default');
    await expect(page.getByRole('tab', { name: 'Objects', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await select('Focus');
    await expect(page.getByRole('textbox', { name: 'Working notes' })).toBeVisible();
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.locator('[data-node-id="timeline-group"]')).toHaveCount(0);
    await expect(switcher.getByRole('button', { name: 'Focus', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await select('Default');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.setViewportSize({ width: 600, height: 850 });
    await expect(switcher).toBeVisible();
    const bounds = await switcher.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(600);
  });

  test(`${framework}: switching with a popout preserves notes`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await page.getByRole('button', { name: 'Inspector actions', exact: true }).click();
    const popupEvent = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open in window', exact: true }).click();
    const popup = await popupEvent;
    await popup.getByRole('textbox', { name: 'Working notes' }).fill('Edited in companion');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Working notes' })).toHaveValue(
      'Edited in companion',
    );
    await expect.poll(() => popup.isClosed()).toBe(true);
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Working notes' })).toHaveValue(
      'Edited in companion',
    );
  });
}
