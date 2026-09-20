import { expect, test } from '@playwright/test';
import type { Axis, Group, Node, Split } from 'quilt-core';
async function setup(page: import('@playwright/test').Page, axis: Axis = 'horizontal') {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate((axis) => {
    const group = (id: string): Group => ({ kind: 'group', id, panes: [id], active: id });
    const split = (id: string, a: Node, b: Node): Split => ({
      kind: 'split',
      id,
      axis,
      ratio: 0.5,
      children: [a, b],
    });
    window.harness.store.loadLayout({
      version: 1,
      maximized: null,
      popouts: [],
      root: split(
        'row',
        group('a'),
        split('tail', split('canvases', group('b'), group('c')), group('d')),
      ),
      panes: Object.fromEntries(
        ['a', 'b', 'c', 'd'].map((id) => [id, { id, type: 'test', title: id.toUpperCase() }]),
      ),
    });
  }, axis);
}
for (const axis of ['horizontal', 'vertical'] as const) {
  test(`${axis}: drag joins across ancestry, expands and contracts its range, preserving views`, async ({
    page,
  }) => {
    await setup(page, axis);
    const region = (id: string) => page.locator(`[data-node-id="${id}"]`);
    const a = (await region('a').boundingBox())!;
    const c = (await region('c').boundingBox())!;
    const d = (await region('d').boundingBox())!;
    const before = await page.evaluate(() => ({ ...window.harness.stats }));
    // A is outside the canvas pair's parent, but shares a full edge with B.
    await region('b').locator('[data-corner="tl"]').hover();
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await expect(page.locator('[data-corner-preview=join-target]')).toContainText('A absorbs B');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.layouts-group')).toHaveCount(4);
    await region('b').locator('[data-corner="br"]').hover();
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(1);
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(2);
    await expect(page.locator('[data-corner-preview=join-target]')).toContainText('D absorbs B, C');
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(1);
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    const preview = (await page.locator('[data-corner-preview=join]').boundingBox())!;
    await page.mouse.up();
    await expect(page.locator('.layouts-group')).toHaveCount(2);
    await expect(region('d').getByRole('tab')).toHaveCount(3);
    const result = (await region('d').boundingBox())!;
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(result[key]).toBeCloseTo(preview[key], 0);
    const afterA = (await region('a').boundingBox())!;
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(afterA[key]).toBeCloseTo(a[key], 0);
    const after = await page.evaluate(() => ({ ...window.harness.stats }));
    expect(after.mounts).toBe(before.mounts);
    expect(after.disposals).toBe(before.disposals);
    expect(after.errors).toEqual([]);
  });
}
test('intermediate permissions block the range, and state changes cancel a pending join', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const layout = window.harness.store.exportLayout();
    layout.panes.c!.capabilities = { join: false };
    window.harness.store.loadLayout(layout);
  });
  const d = (await page.locator('[data-node-id="d"]').boundingBox())!;
  await page.locator('[data-node-id="b"] [data-corner="br"]').hover();
  await page.mouse.down();
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
  await expect(page.locator('[data-corner-preview=join]')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.layouts-group')).toHaveCount(4);
  const a = (await page.locator('[data-node-id="a"]').boundingBox())!;
  await page.locator('[data-node-id="b"] [data-corner="tl"]').hover();
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await expect(page.locator('[data-corner-preview=join]')).toBeVisible();
  await page.evaluate(() => window.harness.store.loadLayout(window.harness.store.exportLayout()));
  await expect(page.locator('.layouts-corner-overlay')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.layouts-group')).toHaveCount(4);
});
