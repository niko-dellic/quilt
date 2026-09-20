import { expect, test } from '@playwright/test';
for (const registry of [true, false]) {
  test(`empty layouts support repeated corner splits (${registry ? 'with' : 'without'} registry)`, async ({
    page,
  }) => {
    await page.goto(`/tests/browser/harness.html${registry ? '' : '?no-registry'}`);
    await page.evaluate(() =>
      window.harness.store.loadLayout({
        version: 1,
        root: { kind: 'group', id: 'empty', panes: [], active: null },
        panes: {},
        popouts: [],
        maximized: null,
      }),
    );
    const source = page.locator('[data-node-id="empty"]');
    for (const axis of ['horizontal', 'vertical'] as const) {
      const beforeIds = await page
        .locator('.layouts-group')
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.nodeId));
      const box = (await source.boundingBox())!;
      const handle = source.locator('[data-corner="br"]');
      await handle.hover();
      await page.mouse.down();
      await page.mouse.move(
        box.x + (axis === 'horizontal' ? box.width * 0.6 : box.width - 10),
        box.y + (axis === 'vertical' ? box.height * 0.6 : box.height - 10),
      );
      const preview = (await page.locator('[data-corner-preview=split]').boundingBox())!;
      await page.mouse.up();
      await expect(page.locator('.layouts-group')).toHaveCount(beforeIds.length + 1);
      const newId = await page
        .locator('.layouts-group')
        .evaluateAll(
          (nodes, ids) =>
            nodes.map((n) => (n as HTMLElement).dataset.nodeId!).find((id) => !ids.includes(id)),
          beforeIds,
        );
      const result = (await page.locator(`[data-node-id="${newId}"]`).boundingBox())!;
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(result[key]).toBeCloseTo(preview[key], 0);
      await expect(source).toBeVisible();
      // Dismiss content search without adding content or removing either region.
      await page.locator('#host').click({ position: { x: 1, y: 1 } });
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.evaluate(() => window.harness.store.loadLayout(window.harness.store.exportLayout()));
    await expect(page.locator('.layouts-group')).toHaveCount(3);
    expect(
      await page.evaluate(() => Object.keys(window.harness.store.exportLayout().panes)),
    ).toEqual([]);
    expect(await page.evaluate(() => window.harness.stats.errors)).toEqual([]);
  });
}
