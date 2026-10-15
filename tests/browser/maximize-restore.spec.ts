import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: maximize and restore preserve region geometry with non-overlay scrollbars`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1512, height: 864 });
    await page.goto(`/${framework}.html`);
    await page.addStyleTag({
      content:
        '.layouts-stage { scrollbar-width: auto; } .layouts-stage::-webkit-scrollbar { width: 15px; height: 15px; }',
    });
    // React mounts asynchronously; never record an empty layout as the baseline.
    await expect(page.locator('[data-node-id="scene-group"]')).toBeVisible();
    const rectangles = () =>
      page.locator('.layouts-node').evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { id: (node as HTMLElement).dataset.nodeId, x, y, width, height };
          })
          .sort((a, b) => a.id!.localeCompare(b.id!)),
      );
    const before = await rectangles();
    for (const name of ['Hotkeys', 'Scene', 'Theming', 'Timeline', 'Scene']) {
      if (name === 'Scene')
        await page.locator('[data-node-id="scene-group"] [data-corner="tl"]').hover();
      else await page.getByRole('tab', { name, exact: true }).hover();
      await page.keyboard.press('`');
      await expect(page.locator('.layouts-stage > .layouts-group')).toHaveCount(1);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await page.keyboard.press('`');
      await expect.poll(rectangles).toEqual(before);
    }
  });
}

test('minimum pane sizes still overflow a small host after restore', async ({ page }) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.locator('#host').evaluate((host) => {
    host.style.width = '150px';
    host.style.height = '80px';
  });
  const stage = page.locator('.layouts-stage');
  const size = () =>
    stage.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
    }));
  // Wait for the host ResizeObserver to finish allocating the minimum widths.
  await expect.poll(async () => (await size()).scrollWidth).toBe(204);
  const before = await size();
  await page.evaluate(() => window.harness.store.maximize('left'));
  await page.evaluate(() => window.harness.store.maximize(null));
  await expect.poll(size).toEqual(before);
  for (const id of ['left', 'right']) {
    expect(
      (await page.locator(`[data-node-id="${id}"]`).boundingBox())!.width,
    ).toBeGreaterThanOrEqual(100);
  }
});
