import { test, expect } from '@playwright/test';
for (const mode of ['disabled', 'protected'] as const) {
  test(`${mode}: the empty surface opens search from any point or keyboard`, async ({ page }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate((mode) => {
      const { store, tabs } = window.harness;
      store.closePane('a', { force: true });
      store.setAutoCollapse(mode);
      tabs.register({
        id: 'new',
        title: 'New tab',
        create: () => ({ id: 'c', title: 'C', type: 'test' }),
      });
    }, mode);
    const group = page.locator('[data-node-id="left"]');
    const surface = group.locator('.layouts-empty');
    await expect(surface).toHaveText('');
    await expect(group.getByText('Empty region', { exact: true })).toHaveCount(0);
    await expect(surface.locator('path')).toHaveAttribute('d', 'M0 0 L100 100 M100 0 L0 100');
    await expect(surface.locator('path')).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    const box = (await surface.boundingBox())!;
    await surface.click({ position: { x: box.width - 25, y: box.height - 25 } });
    const search = page.getByRole('combobox', { name: 'Search tabs' });
    await expect(search).toBeFocused();
    await search.fill('New');
    if (mode === 'protected') await search.fill('');
    await search.press('Escape');
    if (mode === 'disabled') {
      await surface.click({ position: { x: 25, y: 55 } });
      await expect(search).toHaveValue('New');
    } else {
      await expect(search).toHaveCount(0);
      await surface.focus();
      await surface.press('Enter');
    }
    await expect(search).toBeFocused();
    await search.press('Enter');
    await expect(group.getByRole('tab', { name: 'C', exact: true })).toBeVisible();
    await expect(surface).toHaveCount(0);
  });
}
test('a completely empty workspace can create content with no source pane', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const { store, tabs } = window.harness;
    store.closePane('a', { force: true });
    store.closePane('b', { force: true });
    tabs.register({
      id: 'new',
      title: 'New tab',
      create: ({ source }) => {
        if (source !== undefined) throw Error('Expected no source');
        return { id: 'c', title: 'C', type: 'test' };
      },
    });
  });
  const group = page.locator('[data-node-id="left"]');
  await group.locator('.layouts-empty').focus();
  await group.locator('.layouts-empty').press('Space');
  await page.getByRole('option', { name: 'New tab', exact: true }).click();
  await expect(group.getByRole('tab', { name: 'C', exact: true })).toBeVisible();
});
test('outside clicks dismiss search without removing the pane; inside clicks keep it open', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => window.harness.store.closePane('a', { force: true }));
  const left = page.locator('[data-node-id="left"]');
  const surface = left.locator('.layouts-empty');
  await surface.click();
  const search = page.getByRole('combobox', { name: 'Search tabs' });
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS('outline-style', 'none');
  await expect(search).toHaveCSS('box-shadow', 'none');
  await search.fill('query');
  await surface.click({ position: { x: 25, y: 55 } });
  await expect(search).toHaveValue('query');
  await page.locator('[data-node-id="right"]').getByRole('textbox').click();
  await expect(search).toHaveCount(0);
  await expect(surface).toBeVisible();
  await surface.click();
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: 'Return', exact: true }).click();
  await expect(search).toHaveCount(0);
  await expect(surface).toBeVisible();
});
