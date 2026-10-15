import { test, expect } from '@playwright/test';
import type {} from './harness.js';

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const resizeMode of ['border', 'gutter'] as const) {
    test(`${axis} ${resizeMode}: snapping aligns neighboring dividers and cleans up`, async ({
      page,
    }) => {
      await page.goto('/tests/browser/harness.html');
      await page.evaluate(
        ({ axis, resizeMode }) => {
          const group = (id: string) => ({ kind: 'group' as const, id, panes: [id], active: id });
          window.harness.store.updateOptions({ resizeMode });
          window.harness.store.loadLayout({
            version: 1,
            maximized: null,
            popouts: [],
            panes: Object.fromEntries(
              ['a', 'b', 'c', 'd'].map((id) => [id, { id, type: 'test', title: id }]),
            ),
            root: {
              kind: 'split',
              id: 'root',
              axis: axis === 'horizontal' ? 'vertical' : 'horizontal',
              ratio: 0.5,
              children: [
                {
                  kind: 'split',
                  id: 'first',
                  axis,
                  ratio: 0.35,
                  children: [group('a'), group('b')],
                },
                {
                  kind: 'split',
                  id: 'second',
                  axis,
                  ratio: 0.6,
                  children: [group('c'), group('d')],
                },
              ],
            },
          });
        },
        { axis, resizeMode },
      );
      const first = page.locator('[data-node-id="first"] > .layouts-divider');
      const second = page.locator('[data-node-id="second"] > .layouts-divider');
      const a = (await first.boundingBox())!,
        b = (await second.boundingBox())!;
      const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
      const end =
        axis === 'horizontal'
          ? { x: b.x + b.width / 2 + 5, y: start.y }
          : { x: start.x, y: b.y + b.height / 2 + 5 };
      const original = await page.evaluate(() => window.harness.store.exportLayout());
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y);
      await expect(page.locator('.layouts-resize-snap-guide')).toBeVisible();
      const snapped = (await first.boundingBox())!;
      expect(
        axis === 'horizontal' ? snapped.x + snapped.width / 2 : snapped.y + snapped.height / 2,
      ).toBeCloseTo(axis === 'horizontal' ? b.x + b.width / 2 : b.y + b.height / 2, 0);
      await page.mouse.move(
        end.x + (axis === 'horizontal' ? 20 : 0),
        end.y + (axis === 'vertical' ? 20 : 0),
      );
      await expect(page.locator('.layouts-resize-snap-guide')).toBeHidden();
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.layouts-resize-snap-guide')).toHaveCount(0);
      expect(await page.evaluate(() => window.harness.store.exportLayout())).toEqual(original);
      await page.evaluate(() => window.harness.store.updateOptions({ resizeSnapping: false }));
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y);
      await expect(page.locator('.layouts-resize-snap-guide')).toBeHidden();
      const unsnapped = (await first.boundingBox())!;
      expect(
        axis === 'horizontal'
          ? unsnapped.x + unsnapped.width / 2
          : unsnapped.y + unsnapped.height / 2,
      ).toBeCloseTo(axis === 'horizontal' ? end.x : end.y, 0);
      await page.mouse.up();
      await expect(page.locator('.layouts-resize-snap-guide')).toHaveCount(0);
      expect(await page.evaluate(() => window.harness.store.exportWorkspace().resizeSnapping)).toBe(
        false,
      );
      await page.evaluate(() => {
        const preset = window.harness.store.exportWorkspace();
        window.harness.store.updateOptions({ resizeSnapping: true });
        window.harness.store.loadWorkspace(preset);
      });
      expect(await page.evaluate(() => window.harness.store.exportWorkspace().resizeSnapping)).toBe(
        false,
      );
      await page.evaluate(
        ({ saved, axis }) => {
          const original = JSON.parse(saved) as import('quilt-core').Layout;
          original.panes.a!.size = axis === 'horizontal' ? { maxWidth: 400 } : { maxHeight: 100 };
          window.harness.store.updateOptions({ resizeSnapping: true });
          window.harness.store.loadLayout(original);
        },
        { saved: JSON.stringify(original), axis },
      );
      const limitedStart = (await first.boundingBox())!;
      await page.mouse.move(
        limitedStart.x + limitedStart.width / 2,
        limitedStart.y + limitedStart.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(end.x, end.y);
      await expect(page.locator('.layouts-resize-snap-guide')).toBeHidden();
      const limited = (await page.locator('[data-node-id="a"]').boundingBox())!;
      expect(axis === 'horizontal' ? limited.width : limited.height).toBeLessThanOrEqual(
        axis === 'horizontal' ? 400.1 : 100.1,
      );
      await page.mouse.up();
    });
  }
}
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: theming exposes resize snapping enabled by default`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const control = page.getByRole('combobox', { name: 'Resize snapping', exact: true });
    await expect(control).toHaveValue('true');
    await control.selectOption('false');
    await expect(control).toHaveValue('false');
    await control.selectOption('true');
    await expect(control).toHaveValue('true');
  });
}

for (const axis of ['horizontal', 'vertical'] as const) {
  test(`${axis}: alignment guide spans matching edges on both sides`, async ({ page }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate((axis) => {
      const group = (id: string): import('quilt-core').Group => ({
        kind: 'group',
        id,
        panes: [id],
        active: id,
      });
      const band = (id: string, ratio: number): import('quilt-core').Split => ({
        kind: 'split',
        id,
        axis,
        ratio,
        children: [group(id + 'a'), group(id + 'b')],
      });
      const perpendicular = axis === 'horizontal' ? 'vertical' : 'horizontal';
      window.harness.store.updateOptions({ resizeMode: 'border' });
      window.harness.store.loadLayout({
        version: 1,
        maximized: null,
        popouts: [],
        panes: Object.fromEntries(
          ['lefta', 'leftb', 'middlea', 'middleb', 'righta', 'rightb'].map((id) => [
            id,
            { id, title: id, type: 'test' },
          ]),
        ),
        root: {
          kind: 'split',
          id: 'root',
          axis: perpendicular,
          ratio: 1 / 3,
          children: [
            band('left', 0.6),
            {
              kind: 'split',
              id: 'tail',
              axis: perpendicular,
              ratio: 0.5,
              children: [band('middle', 0.35), band('right', 0.6)],
            },
          ],
        },
      });
    }, axis);
    const middle = page.locator('[data-node-id="middle"] > .layouts-divider');
    const left = (await page.locator('[data-node-id="left"]').boundingBox())!;
    const right = (await page.locator('[data-node-id="right"]').boundingBox())!;
    const reference = (await page
      .locator('[data-node-id="left"] > .layouts-divider')
      .boundingBox())!;
    const start = (await middle.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      axis === 'horizontal' ? reference.x + reference.width / 2 + 4 : start.x + start.width / 2,
      axis === 'vertical' ? reference.y + reference.height / 2 + 4 : start.y + start.height / 2,
    );
    const guide = page.locator('.layouts-resize-snap-guide');
    await expect(guide).toBeVisible();
    const box = (await guide.boundingBox())!;
    if (axis === 'horizontal') {
      expect(box.y).toBeCloseTo(left.y, 0);
      expect(box.y + box.height).toBeCloseTo(right.y + right.height, 0);
    } else {
      expect(box.x).toBeCloseTo(left.x, 0);
      expect(box.x + box.width).toBeCloseTo(right.x + right.width, 0);
    }
    await page.mouse.up();
    await expect(guide).toHaveCount(0);
  });
}
