import { test, expect } from '@playwright/test';
import type {} from './harness.js';
test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await expect(page.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
});
test('default stays reserved; taper shapes and region overrides update without remounts', async ({
  page,
}) => {
  const left = page.locator('[data-node-id="left"]');
  const right = page.locator('[data-node-id="right"]');
  await expect(left).toHaveAttribute('data-tab-bar', 'full');
  const reserved = (await left.locator('.layouts-body').boundingBox())!.y;
  const paths = new Set<string>();
  for (const shape of ['angle', 'round', 'scoop'] as const) {
    await page.evaluate(
      (shape) =>
        window.harness.setTabBar({
          mode: 'tapered',
          shape,
          taperWidth: 24,
          regions: { right: { mode: 'full' } },
        }),
      shape,
    );
    await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
    await expect(left.locator('.layouts-tab-cap')).toHaveCSS('width', '24px');
    const expected =
      shape === 'angle'
        ? 'M0 1 L1 0 H0 Z'
        : shape === 'round'
          ? 'M0 1 A1 1 0 0 0 1 0 H0 Z'
          : 'M0 1 A1 1 0 0 1 1 0 H0 Z';
    await expect(left.locator('.layouts-tab-cap > path:first-child')).toHaveAttribute(
      'd',
      expected,
    );
    await expect
      .poll(() =>
        left.locator('.layouts-tab-cap > path:first-child').evaluate((node) => {
          const path = node as SVGGeometryElement;
          // Flush geometry after a scheduled chrome measurement replaces the cap.
          path.getBoundingClientRect();
          return [
            path.isPointInFill(new DOMPoint(0.5, 0.05)),
            path.isPointInFill(new DOMPoint(0.5, 0.95)),
          ];
        }),
      )
      .toEqual([true, false]);
    paths.add((await left.locator('.layouts-tab-cap > path:first-child').getAttribute('d'))!);
    await expect(right).toHaveAttribute('data-tab-bar', 'full');
    expect((await left.locator('.layouts-body').boundingBox())!.y).toBeLessThan(reserved);
    await expect(
      left.getByRole('tab', { name: 'A', exact: true }).locator('.layouts-tab-label'),
    ).toBeVisible();
  }
  expect(paths.size).toBe(3);
  const stats = await page.evaluate(() => window.harness.stats);
  expect(stats.mounts).toBe(2);
  expect(stats.disposals).toBe(0);
  await page.evaluate(() => window.harness.setTabBar({}));
  await expect(left).toHaveAttribute('data-tab-bar', 'full');
  expect((await left.locator('.layouts-body').boundingBox())!.y).toBe(reserved);
});
test('resize and title changes switch the cap without moving content; exposed area receives input', async ({
  page,
}) => {
  const left = page.locator('[data-node-id="left"]');
  await page.evaluate(() => window.harness.setTabBar({ mode: 'tapered' }));
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
  const bodyY = (await left.locator('.layouts-body').boundingBox())!.y;
  const hit = await page.evaluate(() =>
    Boolean(document.elementFromPoint(350, 10)?.closest('.layouts-body')),
  );
  expect(hit).toBe(true);
  await page.evaluate(() => window.harness.store.resize('split', 0.12));
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'true');
  expect((await left.locator('.layouts-body').boundingBox())!.y).toBe(bodyY);
  await expect(left.getByRole('button', { name: 'A actions', exact: true })).toBeVisible();
  await page.evaluate(() => window.harness.store.resize('split', 0.5));
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
  const before = (await left.locator('.layouts-header').boundingBox())!.width;
  await page.evaluate(() =>
    window.harness.store.updatePane({
      ...window.harness.store.getLayout().panes.a!,
      title: 'A much longer tab title',
    }),
  );
  await expect
    .poll(async () => (await left.locator('.layouts-header').boundingBox())!.width)
    .toBeGreaterThan(before);
  await page.evaluate(() => window.harness.setTheme({ headerHeight: '48px' }));
  await expect(left.locator('.layouts-tab-cap')).toHaveCSS('width', '48px');
});
test('rejects invalid options atomically and clears header metrics for hidden headers', async ({
  page,
}) => {
  await page.evaluate(() => window.harness.setTabBar({ mode: 'tapered' }));
  const left = page.locator('[data-node-id="left"]');
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
  expect(
    await page.evaluate(() => {
      try {
        window.harness.setTabBar({ taperWidth: -1 });
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  await expect(left).toHaveAttribute('data-tab-bar', 'tapered');
  await page.evaluate(() =>
    window.harness.store.updatePane({
      ...window.harness.store.getLayout().panes.a!,
      header: false,
    }),
  );
  await expect(left.locator('.layouts-header')).toBeHidden();
  await expect(left).toHaveCSS('--layouts-tab-bar-height', '0px');
  await expect(left).toHaveCSS('--layouts-tab-bar-width', '0px');
});
test('crowded tabs keep the menu and keyboard navigation; disposing removes measured chrome', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.harness.setTabBar({ mode: 'tapered' });
    for (let i = 0; i < 20; i++)
      window.harness.store.insertPane(
        { id: `extra-${i}`, type: 'test', title: `Extra tab ${i}` },
        'left',
      );
  });
  const left = page.locator('[data-node-id="left"]');
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'true');
  await expect(left.locator('.layouts-header > .layouts-button')).toBeVisible();
  await left.getByRole('tab', { name: 'Extra tab 19', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(left.getByRole('tab', { name: 'A', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) window.harness.store.closePane(`extra-${i}`, { force: true });
  });
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
  await page.evaluate(() => window.harness.dispose());
  await expect(page.locator('.layouts-tab-measure,.layouts-tab-cap,.layouts')).toHaveCount(0);
  expect(await page.evaluate(() => window.harness.stats.live)).toBe(0);
});
test('React prop updates retain local pane state', async ({ page }) => {
  await page.goto('/tests/browser/react-tab-bar.html');
  const input = page.getByRole('textbox', { name: 'Retained state' });
  await input.fill('local state survives');
  const group = page.locator('[data-node-id="main"]');
  await page.getByRole('button', { name: 'Taper', exact: true }).click();
  await expect(group).toHaveAttribute('data-tab-bar-filled', 'false');
  await expect(input).toHaveValue('local state survives');
  await page.getByRole('button', { name: 'Full', exact: true }).click();
  await expect(group).toHaveAttribute('data-tab-bar', 'full');
  await expect(input).toHaveValue('local state survives');
  await page.locator('output').click();
  await expect(page.locator('output')).toHaveText('1');
});
test('empty groups retain fitted close and settings chrome', async ({ page }) => {
  await page.evaluate(() => {
    const snapshot = window.harness.store.exportLayout();
    snapshot.root = { kind: 'group', id: 'empty', panes: [], active: null };
    snapshot.panes = {};
    window.harness.store.loadLayout(snapshot);
    window.harness.setTabBar({ mode: 'tapered' });
  });
  const group = page.locator('[data-node-id="empty"]');
  await expect(group.locator('.layouts-header')).toBeVisible();
  await expect(group.getByRole('button', { name: 'Close empty pane' })).toBeDisabled();
  await expect(group).toHaveAttribute('data-tab-bar', 'tapered');
  await expect(group.getByRole('button', { name: 'Empty pane actions' })).toBeVisible();
  const header = (await group.locator('.layouts-header').boundingBox())!;
  const close = (await group.getByRole('button', { name: 'Close empty pane' }).boundingBox())!;
  expect(close.x + close.width).toBeLessThanOrEqual(header.x + header.width);
});
test('vertical edge fits controls without reserving cap space and keeps overlay on overflow', async ({
  page,
}) => {
  const left = page.locator('[data-node-id="left"]');
  await page.evaluate(() =>
    window.harness.setTabBar({ mode: 'tapered', shape: 'vertical', taperWidth: 1000 }),
  );
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
  await expect(left.locator('.layouts-tab-cap')).toHaveCount(0);
  const header = (await left.locator('.layouts-header').boundingBox())!;
  expect(header.width).toBeLessThan((await left.boundingBox())!.width);
  await expect(left).toHaveCSS('--layouts-tab-bar-width', `${header.width}px`);
  const bodyY = (await left.locator('.layouts-body').boundingBox())!.y;
  await page.evaluate(() => window.harness.store.resize('split', 0.12));
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'true');
  expect((await left.locator('.layouts-body').boundingBox())!.y).toBe(bodyY);
  await page.evaluate(() => window.harness.store.resize('split', 0.5));
  await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
  await expect(left.locator('.layouts-tab-cap')).toHaveCount(0);
});
test('fitted bars have one closed outline covering all edges without intercepting controls', async ({
  page,
}) => {
  const left = page.locator('[data-node-id="left"]');
  for (const shape of ['angle', 'round', 'scoop', 'vertical'] as const) {
    await page.evaluate((shape) => window.harness.setTabBar({ mode: 'tapered', shape }), shape);
    const outline = left.locator('.layouts-tab-outline');
    await expect(outline).toHaveCount(1);
    await expect(outline).toHaveCSS('pointer-events', 'none');
    await expect
      .poll(() =>
        outline.locator('path').evaluate((node) => {
          const path = node as SVGGeometryElement;
          path.getBoundingClientRect();
          const box = path.getBBox();
          return {
            closed: path.getAttribute('d')!.endsWith('Z'),
            top: path.isPointInStroke(new DOMPoint(10, 0.5)),
            left: path.isPointInStroke(new DOMPoint(0.5, 10)),
            bottom: path.isPointInStroke(new DOMPoint(10, box.y + box.height)),
          };
        }),
      )
      .toEqual({ closed: true, top: true, left: true, bottom: true });
    const tab = left.getByRole('tab', { name: 'A', exact: true });
    await tab.click();
    await expect(tab).toBeFocused();
  }
  await page.evaluate(() => window.harness.setTabBar({ mode: 'full' }));
  await expect(left.locator('.layouts-tab-outline')).toHaveCount(0);
});
test('fractional widths stay contained and settle across close-button breakpoints', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.harness.store.updatePane({
      ...window.harness.store.getLayout().panes.b!,
      title: 'Inspector',
    });
    window.harness.store.insertPane({ id: 'activity', type: 'test', title: 'Activity' }, 'right');
  });
  for (const shape of ['angle', 'round', 'scoop', 'vertical'] as const) {
    await page.evaluate((shape) => window.harness.setTabBar({ mode: 'tapered', shape }), shape);
    for (const width of [310.75, 270.75, 240.75, 200.75, 160.75, 240.75, 310.75]) {
      const samples = await page.evaluate(async (width) => {
        const region = document.querySelector<HTMLElement>('[data-node-id="right"]')!;
        const parent = region.parentElement!;
        window.harness.store.resize('split', 1 - width / (parent.clientWidth - 6));
        const frames: {
          width: number;
          occupied: number;
          filled: string | undefined;
        }[] = [];
        for (let i = 0; i < 8; i++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const outline = region.querySelector<SVGElement>('.layouts-tab-outline')!;
          frames.push({
            width: region.getBoundingClientRect().width,
            occupied: outline.getBoundingClientRect().width,
            filled: region.dataset.tabBarFilled,
          });
        }
        return frames.slice(3);
      }, width);
      expect(new Set(samples.map((sample) => JSON.stringify(sample))).size).toBe(1);
      for (const sample of samples)
        expect(sample.occupied).toBeLessThanOrEqual(sample.width + 0.02);
    }
  }
});
test('fitted bars collapse before their end reaches the pane edge', async ({ page }) => {
  const left = page.locator('[data-node-id="left"]');
  for (const shape of ['angle', 'round', 'scoop', 'vertical'] as const) {
    await left.evaluate((el) => {
      el.style.width = '400px';
    });
    await page.evaluate((shape) => window.harness.setTabBar({ mode: 'tapered', shape }), shape);
    await expect(left.locator('.layouts-header')).toHaveAttribute('data-tab-bar-shape', shape);
    await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
    const footprint = await left.evaluate((el) =>
      parseFloat(el.style.getPropertyValue('--layouts-tab-bar-width')),
    );
    const bodyY = (await left.locator('.layouts-body').boundingBox())!.y;
    await left.evaluate((el, width) => {
      el.style.width = `${width + 11}px`;
    }, footprint);
    await expect(left).toHaveAttribute('data-tab-bar-filled', 'true');
    await expect(left.locator('.layouts-tab-cap')).toHaveCount(0);
    expect((await left.locator('.layouts-body').boundingBox())!.y).toBe(bodyY);
    await left.evaluate((el, width) => {
      el.style.width = `${width + 13}px`;
    }, footprint);
    await expect(left).toHaveAttribute('data-tab-bar-filled', 'false');
    expect((await left.locator('.layouts-body').boundingBox())!.y).toBe(bodyY);
  }
});
test('left icon rail reserves space, labels icons, navigates vertically and restores top tabs', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.harness.store.movePane('b', 'left');
    window.harness.setTabBar({ placement: 'left', display: 'compact' });
  });
  const group = page.locator('[data-node-id="left"]');
  await expect(group).toHaveAttribute('data-tab-placement', 'left');
  await expect(group.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  const a = group.getByRole('tab', { name: 'A', exact: true });
  const b = group.getByRole('tab', { name: 'B', exact: true });
  await a.hover();
  await expect(page.getByRole('tooltip')).toHaveText('A');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(a.locator('.layouts-tab-label')).toBeHidden();
  await expect(a.locator('.layouts-tab-icon')).toBeVisible();
  const header = (await group.locator('.layouts-header').boundingBox())!;
  const body = (await group.locator('.layouts-body').boundingBox())!;
  expect(header.width).toBe(32);
  expect(body.x).toBe(header.x + header.width);
  expect(body.y).toBe(header.y);
  await a.focus();
  await a.press('ArrowDown');
  await expect(b).toBeFocused();
  await expect(b).toHaveAttribute('aria-selected', 'true');
  await b.press('ArrowUp');
  await expect(a).toBeFocused();
  await group.getByRole('button', { name: 'A actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close active tab', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.harness.setTabBar({ mode: 'tapered' }));
  await expect(group).toHaveAttribute('data-tab-placement', 'top');
  await expect(a.locator('.layouts-tab-label')).toBeVisible();
  expect(await page.evaluate(() => window.harness.stats)).toMatchObject({
    mounts: 2,
    disposals: 0,
  });
});
test('left fitted shapes keep content fixed and collapse with bottom clearance', async ({
  page,
}) => {
  await page.evaluate(() => window.harness.store.movePane('b', 'left'));
  const group = page.locator('[data-node-id="left"]');
  for (const shape of ['angle', 'round', 'scoop', 'vertical'] as const) {
    await group.evaluate((el) => {
      el.style.height = '400px';
    });
    await page.evaluate(
      (shape) =>
        window.harness.setTabBar({ placement: 'left', mode: 'tapered', shape, taperWidth: 24 }),
      shape,
    );
    await expect(group.locator('.layouts-header')).toHaveAttribute('data-tab-bar-shape', shape);
    await expect(group).toHaveAttribute('data-tab-bar-filled', 'false');
    const body = (await group.locator('.layouts-body').boundingBox())!;
    expect(body.x).toBe((await group.boundingBox())!.x);
    await expect(group.locator('.layouts-tab-cap')).toHaveCount(shape === 'vertical' ? 0 : 1);
    const height = await group.evaluate((el) =>
      parseFloat(el.style.getPropertyValue('--layouts-tab-bar-height')),
    );
    await group.evaluate((el, height) => {
      el.style.height = `${height + 11}px`;
    }, height);
    await expect(group).toHaveAttribute('data-tab-bar-filled', 'true');
    await expect(group.locator('.layouts-tab-cap')).toHaveCount(0);
    const after = (await group.locator('.layouts-body').boundingBox())!;
    expect(after.x).toBe(body.x);
    expect(after.y).toBe(body.y);
  }
});
test('tooltips follow actual label visibility in both orientations', async ({ page }) => {
  const tab = page.locator('[data-node-id="left"]').getByRole('tab', { name: 'A', exact: true });
  const label = tab.locator('.layouts-tab-label');
  for (const placement of ['top', 'left'] as const) {
    await page.mouse.move(1100, 700);
    await page.evaluate((placement) => {
      window.harness.store.resize('split', 0.5);
      window.harness.setTheme({ headerWidth: '180px' });
      window.harness.setTabBar({ placement, display: 'automatic' });
    }, placement);
    await expect(label).toBeVisible();
    await tab.focus();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(tab).not.toHaveAttribute('title');
    await page.evaluate((placement) => {
      if (placement === 'top') window.harness.store.resize('split', 0.12);
      else window.harness.setTheme({ headerWidth: '32px' });
    }, placement);
    await expect(label).toBeHidden();
    await tab.hover();
    await expect(page.getByRole('tooltip')).toHaveText('A');
    await page.evaluate((placement) => {
      if (placement === 'top') window.harness.store.resize('split', 0.5);
      else window.harness.setTheme({ headerWidth: '180px' });
    }, placement);
    await expect(label).toBeVisible();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.evaluate(
      (placement) => window.harness.setTabBar({ placement, display: 'compact' }),
      placement,
    );
    await tab.hover();
    await expect(page.getByRole('tooltip')).toHaveText('A');
    await page.keyboard.press('Escape');
  }
});
