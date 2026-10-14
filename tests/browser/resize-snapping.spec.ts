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
