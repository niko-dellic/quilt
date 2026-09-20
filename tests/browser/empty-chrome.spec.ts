import { test, expect } from '@playwright/test';
for (const placement of ['top', 'left'] as const) {
  for (const shape of ['angle', 'round', 'scoop', 'vertical'] as const) {
    test(`${placement} ${shape}: empty chrome fits close and settings controls`, async ({
      page,
    }) => {
      await page.goto('/tests/browser/harness.html');
      await page.evaluate(
        ({ placement, shape }) => {
          window.harness.setTabBar({ mode: 'tapered', placement, shape, taperWidth: 24 });
          window.harness.store.closePane('a', { force: true });
        },
        { placement, shape },
      );
      const group = page.locator('[data-node-id="left"]');
      const header = group.locator('.layouts-header');
      await expect(group).toHaveAttribute('data-tab-bar', 'tapered');
      await expect(group).toHaveAttribute('data-tab-bar-filled', 'false');
      await expect(header).toHaveAttribute('data-tab-bar-shape', shape);
      await expect(header.locator('.layouts-tab-cap')).toHaveCount(shape === 'vertical' ? 0 : 1);
      const close = group.getByRole('button', { name: 'Close empty pane', exact: true });
      const settings = group.getByRole('button', { name: 'Empty pane actions', exact: true });
      await expect(close).toBeVisible();
      await expect(settings).toBeVisible();
      const bounds = (await header.boundingBox())!;
      const region = (await group.boundingBox())!;
      expect(placement === 'top' ? bounds.width : bounds.height).toBeLessThan(120);
      expect(placement === 'top' ? bounds.width : bounds.height).toBeLessThan(
        placement === 'top' ? region.width : region.height,
      );
      for (const control of [close, settings]) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bounds.x);
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      }
      await settings.click();
      await expect(page.getByRole('dialog', { name: 'Empty pane actions' })).toBeVisible();
      await page.getByRole('button', { name: 'Maximize region', exact: true }).click();
      await settings.click();
      await page.getByRole('button', { name: 'Restore region', exact: true }).click();
      await close.click();
      await expect(group).toHaveCount(0);
    });
  }
}
test('empty root settings remain usable without any source pane', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.store.closePane('a', { force: true });
    window.harness.store.removeEmptyGroup('left');
    window.harness.store.closePane('b', { force: true });
    window.harness.setTabBar({ mode: 'tapered', shape: 'round' });
  });
  await expect(page.getByRole('button', { name: 'Close empty pane', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Empty pane actions' }).click();
  const dialog = page.getByRole('dialog', { name: 'Empty pane actions' });
  await expect(dialog.getByRole('button', { name: '+ Add tab', exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Close empty pane', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
});
