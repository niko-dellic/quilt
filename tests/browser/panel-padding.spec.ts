import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: panel padding aligns floating chrome and content`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Hotkeys', exact: true }).click();
    const region = page.locator('[data-node-id="tools-group"]');
    for (const padding of [8, 16, 0]) {
      await page.locator('.layouts').evaluate((root, value) => {
        (root as HTMLElement).style.setProperty('--layouts-panel-padding', `${value}px`);
      }, padding);
      await expect
        .poll(async () => {
          const pane = (await region.boundingBox())!;
          const header = (await region.locator('.layouts-header').boundingBox())!;
          const table = (await region.locator('.hotkey-table-frame').boundingBox())!;
          return [
            Math.round(header.x - pane.x),
            Math.round(table.x - pane.x),
            Math.round(table.y - header.y - header.height),
          ];
        })
        .toEqual([padding, padding, padding]);
    }
  });
}

test('typed theme updates the floating panel inset', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.setTabBar({ attachment: 'floating' });
    window.harness.setTheme({ panelPadding: '14px' });
  });
  await expect(page.locator('[data-node-id="left"] > .layouts-header')).toHaveCSS(
    '--layouts-floating-inset-x',
    '14px',
  );
});
