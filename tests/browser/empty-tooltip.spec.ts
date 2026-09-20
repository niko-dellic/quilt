import { test, expect } from '@playwright/test';
for (const placement of ['top', 'left'] as const) {
  test(`${placement}: empty pane uses a centered shared tooltip and hides it on interaction`, async ({
    page,
  }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate((placement) => {
      window.harness.setTabBar({ mode: 'tapered', placement });
      window.harness.store.closePane('a', { force: true });
    }, placement);
    const group = page.locator('[data-node-id="left"]');
    const surface = group.locator('.layouts-empty');
    const tip = page.getByRole('tooltip');
    await surface.hover();
    await expect(tip).toHaveText('Click to add a pane');
    await expect(tip).toHaveClass('layouts-tab-tooltip');
    await expect(surface).not.toHaveAttribute('title');
    const pane = (await group.boundingBox())!;
    const hint = (await tip.boundingBox())!;
    expect(Math.abs(hint.x + hint.width / 2 - pane.x - pane.width / 2)).toBeLessThan(1);
    expect(Math.abs(hint.y + hint.height / 2 - pane.y - pane.height / 2)).toBeLessThan(1);
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await page.getByRole('button', { name: 'Return', exact: true }).hover();
    await surface.hover();
    await expect(tip).toBeVisible();
    await surface.click();
    await expect(page.getByRole('combobox', { name: 'Search tabs' })).toBeFocused();
    await expect(tip).toHaveCount(0);
    await surface.hover({ position: { x: 100, y: 100 } });
    await expect(tip).toHaveCount(0);
    await page.getByRole('button', { name: 'Return', exact: true }).click();
    await surface.hover();
    await expect(tip).toBeVisible();
    await page.evaluate(() =>
      window.harness.store.insertPane({ id: 'c', title: 'C', type: 'test' }, 'left'),
    );
    await expect(tip).toHaveCount(0);
    await page.evaluate(() => window.harness.store.closePane('c', { force: true }));
    await surface.hover({ position: { x: 100, y: 100 } });
    await expect(tip).toBeVisible();
    await page.evaluate(() => window.harness.dispose());
    await expect(tip).toHaveCount(0);
  });
}
