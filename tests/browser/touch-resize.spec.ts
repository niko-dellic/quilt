import { expect, test } from '@playwright/test';
import type {} from './harness.js';

test.use({ hasTouch: true });

for (const mode of ['border', 'gutter'] as const) {
  for (const axis of ['horizontal', 'vertical'] as const) {
    test(`${mode}, ${axis}: native touch drags the expanded target without scrolling`, async ({
      page,
      browserName,
      context,
    }) => {
      test.skip(browserName !== 'chromium', 'Native touch drag injection requires Chromium CDP.');
      await page.goto('/tests/browser/harness.html');
      await page.evaluate(
        ({ mode, axis }) => {
          const w = window.harness.mounted;
          const layout = w.exportLayout();
          if (layout.root.kind === 'split') layout.root.axis = axis;
          w.loadLayout(layout);
          w.updateOptions({ resizeMode: mode });
        },
        { mode, axis },
      );
      const divider = page.getByRole('separator', { includeHidden: true });
      await expect(divider).toHaveCSS('touch-action', 'none');
      if (mode === 'border')
        expect(await divider.evaluate((el) => getComputedStyle(el, '::before').opacity)).toBe('1');
      const box = (await divider.boundingBox())!;
      const horizontal = axis === 'horizontal';
      let x = box.x + box.width / 2 + (horizontal ? 10 : 0);
      let y = box.y + box.height / 2 + (horizontal ? 0 : 10);
      // Start outside the visible divider but within its expanded touch target.
      expect(
        await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('role'), {
          x,
          y,
        }),
      ).toBe('separator');
      const cdp = await context.newCDPSession(page);
      const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', delta = 0) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints:
            type === 'touchEnd' || type === 'touchCancel'
              ? []
              : [{ x: x + (horizontal ? delta : 0), y: y + (horizontal ? 0 : delta), id: 1 }],
        });
      await touch('touchStart');
      await expect(divider).toHaveAttribute('data-resizing', 'true');
      await touch('touchMove', 1);
      expect(Number(await divider.getAttribute('aria-valuenow'))).toBe(50);
      await touch('touchMove', 90);
      await expect.poll(() => divider.getAttribute('aria-valuenow')).not.toBe('50');
      await touch('touchEnd');
      await expect(divider).not.toHaveAttribute('data-resizing');
      const resized = await divider.getAttribute('aria-valuenow');
      expect(Number(resized)).toBeGreaterThan(55);
      expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
      const moved = (await divider.boundingBox())!;
      x = moved.x + moved.width / 2;
      y = moved.y + moved.height / 2;
      await touch('touchStart');
      await expect(divider).toHaveAttribute('data-resizing', 'true');
      await touch('touchCancel');
      await expect(page.locator('.layouts')).not.toHaveClass(/layouts-resizing/);
      expect(await divider.getAttribute('aria-valuenow')).toBe(resized);
      await page.evaluate(() =>
        window.harness.mounted.updateOptions({ capabilities: { defaults: { resize: false } } }),
      );
      await expect(divider).toHaveAttribute('aria-disabled', 'true');
      await touch('touchStart');
      await touch('touchMove', -80);
      await touch('touchEnd');
      expect(await divider.getAttribute('aria-valuenow')).toBe(resized);
      expect(await page.evaluate(() => window.harness.stats.errors)).toEqual([]);
      await cdp.detach();
    });
  }
}

test('only the initiating touch controls a resize; capture loss releases drag state', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(() => {
    const divider = document.querySelector<HTMLElement>('[role="separator"]')!;
    const box = divider.getBoundingClientRect();
    // Synthetic pointers have no native capture; exercise handler ownership separately.
    divider.setPointerCapture = () => {};
    divider.releasePointerCapture = () => {};
    const send = (type: string, pointerId: number, x: number, isPrimary = pointerId === 1) =>
      divider.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerType: 'touch',
          pointerId,
          isPrimary,
          button: 0,
          clientX: x,
          clientY: box.y + 100,
        }),
      );
    const value = () => divider.getAttribute('aria-valuenow');
    const active = () => divider.hasAttribute('data-resizing');
    send('pointerdown', 1, box.x);
    send('pointermove', 1, box.x + 60);
    const primary = value();
    send('pointerdown', 2, box.x);
    send('pointermove', 2, box.x - 100);
    send('pointerup', 2, box.x);
    send('pointercancel', 2, box.x);
    const afterSecondary = { value: value(), active: active() };
    send('lostpointercapture', 1, box.x);
    const afterLoss = active();
    send('pointermove', 1, box.x - 200);
    const afterMove = value();
    send('pointerdown', 1, box.x);
    send('pointercancel', 1, box.x);
    return { primary, afterSecondary, afterLoss, afterMove, afterCancel: active() };
  });
  expect(Number(result.primary)).toBeGreaterThan(50);
  expect(result.afterSecondary).toEqual({ value: result.primary, active: true });
  expect(result.afterLoss).toBe(false);
  expect(result.afterMove).toBe(result.primary);
  expect(result.afterCancel).toBe(false);
});
