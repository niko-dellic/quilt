import { test, expect } from '@playwright/test';
import type {} from './harness.js';
for (const axis of ['horizontal', 'vertical'] as const) {
  for (const nestedFirst of [false, true]) {
    test(`${axis}, nested ${nestedFirst ? 'first' : 'second'} branch: resize preserves distant pane`, async ({
      page,
    }) => {
      await page.goto('/tests/browser/harness.html');
      await page.evaluate(
        ({ axis, nestedFirst }) => {
          const group = (id: string) => ({ kind: 'group' as const, id, panes: [id], active: id });
          const nested = {
            kind: 'split' as const,
            id: 'nested',
            axis,
            ratio: 0.5,
            children: [group('b'), group('c')] as [
              ReturnType<typeof group>,
              ReturnType<typeof group>,
            ],
          };
          window.harness.store.loadLayout({
            version: 1,
            maximized: null,
            popouts: [],
            panes: Object.fromEntries(
              ['a', 'b', 'c'].map((id) => [
                id,
                { id, type: 'test', title: id, size: { minWidth: 80, minHeight: 60 } },
              ]),
            ),
            root: {
              kind: 'split',
              id: 'outer',
              axis,
              ratio: nestedFirst ? 0.65 : 0.35,
              children: nestedFirst ? [nested, group('a')] : [group('a'), nested],
            },
          });
        },
        { axis, nestedFirst },
      );
      const far = page.locator(`[data-node-id="${nestedFirst ? 'b' : 'c'}"]`);
      const before = (await far.boundingBox())!;
      const original = await page.evaluate(() => window.harness.store.exportLayout());
      const divider = page.locator('[data-node-id="outer"] > .layouts-divider');
      const box = (await divider.boundingBox())!;
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        x + (axis === 'horizontal' ? 40 : 0),
        y + (axis === 'vertical' ? 40 : 0),
        { steps: 5 },
      );
      const during = (await far.boundingBox())!;
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(during[key]).toBeCloseTo(before[key], 1);
      expect(await page.evaluate(() => window.harness.store.exportLayout())).not.toEqual(original);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(await page.evaluate(() => window.harness.store.exportLayout())).toEqual(original);
      await divider.focus();
      await page.keyboard.press(axis === 'horizontal' ? 'ArrowLeft' : 'ArrowUp');
      const after = (await far.boundingBox())!;
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(after[key]).toBeCloseTo(before[key], 1);
    });
  }
}
