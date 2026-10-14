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
    await expect(page.locator('[data-corner-preview=join-target]')).toContainText('B absorbs A');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.layouts-group')).toHaveCount(4);
    await region('b').locator('[data-corner="br"]').hover();
    await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(1);
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(2);
    await expect(page.locator('[data-corner-preview=join-target]')).toContainText('B absorbs C, D');
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(1);
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    const preview = (await page.locator('[data-corner-preview=join]').boundingBox())!;
    await page.mouse.up();
    await expect(page.locator('.layouts-group')).toHaveCount(2);
    await expect(region('b').getByRole('tab')).toHaveCount(3);
    await expect(region('b').getByRole('tab', { name: 'B', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const result = (await region('b').boundingBox())!;
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
  await expect(page.locator('[data-corner-preview=join-invalid]')).toContainText(
    'These regions cannot be joined',
  );
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

test('rectangular join crosses rows, preserves surrounding geometry and retains all views', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const rows: Node[] = Array.from({ length: 3 }, (_, r) => {
      const cells: Node[] = Array.from({ length: 3 }, (_, c) => ({
        kind: 'group',
        id: `g${r}${c}`,
        panes: [`p${r}${c}`],
        active: `p${r}${c}`,
      }));
      return {
        kind: 'split',
        id: `row${r}`,
        axis: 'horizontal',
        ratio: 1 / 3,
        children: [
          cells[0]!,
          {
            kind: 'split',
            id: `tail${r}`,
            axis: 'horizontal',
            ratio: 0.5,
            children: [cells[1]!, cells[2]!],
          },
        ],
      };
    });
    window.harness.store.loadLayout({
      version: 1,
      maximized: null,
      popouts: [],
      root: {
        kind: 'split',
        id: 'grid',
        axis: 'vertical',
        ratio: 1 / 3,
        children: [
          rows[0]!,
          {
            kind: 'split',
            id: 'rows',
            axis: 'vertical',
            ratio: 0.5,
            children: [rows[1]!, rows[2]!],
          },
        ],
      },
      panes: Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => {
          const id = `p${Math.floor(i / 3)}${i % 3}`;
          return [id, { id, type: 'test', title: id }];
        }),
      ),
    });
  });
  const region = (id: string) => page.locator(`[data-node-id="${id}"]`);
  const outside = ['g02', 'g12', 'g20', 'g21', 'g22'];
  const before = await Promise.all(outside.map((id) => region(id).boundingBox()));
  const stats = await page.evaluate(() => ({ ...window.harness.stats }));
  const target = (await region('g11').boundingBox())!;
  await region('g00').locator('[data-corner="br"]').hover();
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await expect(page.locator('[data-corner-preview=join-source]')).toHaveCount(3);
  const last = (await region('g22').boundingBox())!;
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  const label = page.locator('[data-corner-preview=join-target] .layouts-corner-label');
  await expect(label).toContainText('and 6 more');
  expect(
    await label.evaluate(
      (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
    ),
  ).toBe(true);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);

  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.layouts-group')).toHaveCount(9);
  await region('g00').locator('[data-corner="br"]').hover();
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  const preview = (await page.locator('[data-corner-preview=join]').boundingBox())!;
  await page.mouse.up();
  await expect(page.locator('.layouts-group')).toHaveCount(6);
  await expect(region('g00').getByRole('tab')).toHaveCount(4);
  await expect(region('g00').getByRole('tab', { name: 'p00', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const merged = (await region('g00').boundingBox())!;
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(merged[key]).toBeCloseTo(preview[key], 0);
  for (const [i, id] of outside.entries()) {
    const after = (await region(id).boundingBox())!;
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(after[key]).toBeCloseTo(before[i]![key], 0);
  }
  const after = await page.evaluate(() => ({ ...window.harness.stats }));
  expect(after.mounts).toBe(stats.mounts);
  expect(after.disposals).toBe(stats.disposals);
  expect(after.errors).toEqual([]);
});

test('merge preview falls back to a count when pane names cannot fit', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const layout = window.harness.store.exportLayout();
    for (const pane of Object.values(layout.panes)) pane.title = 'Long pane title '.repeat(50);
    window.harness.store.loadLayout(layout);
  });
  const destination = (await page.locator('[data-node-id="d"]').boundingBox())!;
  await page.locator('[data-node-id="b"] [data-corner="br"]').hover();
  await page.mouse.down();
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
  );
  const label = page.locator('[data-corner-preview=join-target] .layouts-corner-label');
  await expect(label).toHaveText('Merge 3 regions');
  expect(
    await label.evaluate(
      (el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});
