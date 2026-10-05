import { expect, test } from '@playwright/test';
import type {} from './harness.js';

for (const enhanced of [false, true]) {
  test(`maximize retains nested scroll positions, inactive tabs, and later user scrolling (custom: ${enhanced})`, async ({
    page,
  }) => {
    await page.goto('/tests/browser/harness.html');
    if (enhanced)
      await page.evaluate(() =>
        window.harness.mounted.updateOptions({ scrollbars: { placement: 'gutter' } }),
      );
    await page.evaluate(() => {
      const w = window.harness.store;
      const layout = w.exportLayout();
      layout.panes.c = { id: 'c', type: 'test', title: 'C' };
      if (layout.root.kind === 'split' && layout.root.children[1].kind === 'group')
        layout.root.children[1].panes.push('c');
      w.loadLayout(layout);
      for (const id of ['a', 'b', 'c']) {
        const pane = document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!;
        pane.style.overflow = 'auto';
        const content = document.createElement('div');
        content.style.cssText = 'width:1800px;height:1800px';
        const nested = document.createElement('div');
        nested.dataset.scrollTest = id;
        nested.style.cssText = 'width:180px;height:160px;overflow:auto';
        const filler = document.createElement('div');
        filler.style.cssText = 'width:900px;height:900px';
        nested.append(filler);
        content.append(nested);
        pane.append(content);
      }
      w.activatePane('b');
    });
    const scroll = async (id: string, top: number, left: number) =>
      page.evaluate(
        ({ id, top, left }) => {
          const pane = document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!;
          pane.scrollTop = top;
          pane.scrollLeft = left;
          const nested = pane.querySelector<HTMLElement>('[data-scroll-test]')!;
          nested.scrollTop = top + 10;
          nested.scrollLeft = left + 10;
        },
        { id, top, left },
      );
    const check = async (id: string, top: number, left: number) => {
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const pane = document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!;
            const nested = pane.querySelector<HTMLElement>('[data-scroll-test]')!;
            return [pane.scrollTop, pane.scrollLeft, nested.scrollTop, nested.scrollLeft];
          }, id),
        )
        .toEqual([top, left, top + 10, left + 10]);
    };
    await scroll('b', 220, 120);
    await page.evaluate(() => window.harness.store.activatePane('c'));
    await scroll('c', 310, 140);
    await scroll('a', 180, 100);
    await page.evaluate(() => window.harness.store.maximize('left'));
    await check('a', 180, 100);
    await scroll('a', 250, 150);
    // Option refreshes also repaint the tree while its sibling regions are detached.
    await page.evaluate(() => window.harness.mounted.updateOptions({ theme: { accent: 'red' } }));
    await check('a', 250, 150);
    await page.evaluate(() => window.harness.store.maximize(null));
    await check('a', 250, 150);
    await check('c', 310, 140);
    await page.evaluate(() => window.harness.store.activatePane('b'));
    await check('b', 220, 120);
    await scroll('b', 0, 0);
    await page.evaluate(() => window.harness.store.maximize('left'));
    await page.evaluate(() => window.harness.store.maximize('right'));
    await check('b', 0, 0);
    await page.evaluate(() => window.harness.store.maximize(null));
    await check('b', 0, 0);
    expect(await page.evaluate(() => window.harness.stats)).toMatchObject({
      mounts: 3,
      disposals: 0,
      errors: [],
    });
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: another region's maximize shortcut preserves settings scroll`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const settings = page.getByRole('tabpanel', { name: 'Settings', exact: true });
    await expect(settings).toBeVisible();
    const scroller = page.locator('.demo-settings');
    await scroller.evaluate((element) => {
      element.scrollTop = 180;
    });
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(180);
    await page.getByRole('tab', { name: 'Scene', exact: true }).hover();
    await page.keyboard.press('Backquote');
    await expect(settings).toBeHidden();
    await page.keyboard.press('Backquote');
    await expect(settings).toBeVisible();
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(180);
  });
}
