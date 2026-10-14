import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  for (const entry of ['hotkey', 'menu']) {
    test(`${framework}: ${entry} add-tab picker stays centered in its pane`, async ({ page }) => {
      await page.goto(`/${framework}.html`);
      const region = page.locator('[data-node-id="scene-group"]');
      if (entry === 'hotkey') {
        await region.getByRole('tab', { name: 'Scene', exact: true }).hover();
        await page.keyboard.press('t');
      } else {
        await region.getByRole('button', { name: 'Scene actions', exact: true }).click();
        await page.getByRole('button', { name: '+ Add tab', exact: true }).click();
      }
      const picker = page.locator('dialog.layouts-picker');
      await expect(page.getByRole('combobox', { name: 'Search tabs' })).toBeFocused();
      const check = async () => {
        await expect
          .poll(async () => {
            const pane = (await region.boundingBox())!;
            const box = (await picker.boundingBox())!;
            return Math.max(
              Math.abs(box.x + box.width / 2 - pane.x - pane.width / 2),
              Math.abs(box.y + box.height / 2 - pane.y - pane.height / 2),
            );
          })
          .toBeLessThan(1);
      };
      await check();
      await page.getByRole('combobox', { name: 'Search tabs' }).fill('viewport');
      await check();
      await page.setViewportSize({ width: 1100, height: 800 });
      await check();
      await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(picker).toHaveCount(0);
    });
  }
}

for (const edge of ['left', 'right'] as const) {
  test(`picker escapes a short narrow pane at the bottom ${edge} and stays inside the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/tests/browser/harness.html');
    await page.addStyleTag({
      content: `#host { position: fixed; bottom: 0; ${edge}: 0; width: 240px !important; height: 100px !important; }`,
    });
    await page.evaluate(() => {
      for (let index = 0; index < 20; index++)
        window.harness.tabs.register({
          id: `view-${index}`,
          title: `View ${index}`,
          description: 'A searchable pane type',
          create: () => ({ id: `added-${index}`, type: 'test', title: `View ${index}` }),
        });
    });
    await page.getByRole('tab', { name: 'B', exact: true }).click({ button: 'right' });
    await page.getByRole('button', { name: '+ Add tab', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Choose a tab' });
    const search = picker.getByRole('combobox', { name: 'Search tabs' });
    const check = async () => {
      await expect
        .poll(() =>
          picker.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return (
              rect.left >= 7 &&
              rect.top >= 7 &&
              rect.right <= innerWidth - 7 &&
              rect.bottom <= innerHeight - 7
            );
          }),
        )
        .toBe(true);
      for (const control of [search, picker.getByRole('button', { name: 'Cancel', exact: true })]) {
        expect(
          await control.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return node.contains(
              document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
            );
          }),
        ).toBe(true);
      }
    };
    await check();
    expect((await picker.boundingBox())!.height).toBeGreaterThan(200);
    await search.fill('View 19');
    await expect(picker.getByRole('option')).toHaveCount(1);
    await check();
    await search.fill('');
    await page.setViewportSize({ width: 240, height: 220 });
    await check();
    await search.press('End');
    await search.press('ArrowUp');
    await search.press('Enter');
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'View 19', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.harness.stats.errors)).toEqual([]);
  });
}
