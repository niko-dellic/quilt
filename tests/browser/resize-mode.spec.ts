import { expect, test } from '@playwright/test';
import type {} from './harness.js';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: border mode shares edges and shows a hover grip without changing saved geometry`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const mode = page
      .getByRole('region', { name: 'Resizing', exact: true })
      .getByRole('combobox', { name: 'Resize style', exact: true });
    await expect(
      page
        .getByRole('tabpanel', { name: 'Settings', exact: true })
        .getByRole('combobox', { name: 'Resize style', exact: true }),
    ).toHaveCount(0);
    await expect(mode).toHaveValue('border');
    const width = page.getByRole('slider', { name: 'Resize handle width', includeHidden: true });
    const disabled = page.getByRole('checkbox', {
      name: 'Show disabled resize handles',
      includeHidden: true,
    });
    await expect(width).toBeHidden();
    await expect(disabled).toBeHidden();
    await mode.selectOption('gutter');
    await expect(width).toBeVisible();
    await expect(disabled).toBeVisible();
    const split = page.locator('[data-node-id="tools-split"]');
    const divider = split.locator(':scope > .layouts-divider');
    const left = page.locator('[data-node-id="tools-group"]');
    const right = page.locator('[data-node-id="inspector-split"]');
    const before = (await divider.boundingBox())!.width;
    expect(before).toBe(4);
    await mode.selectOption('border');
    await expect(width).toBeHidden();
    await expect(disabled).toBeHidden();
    await expect(page.locator('.layouts').first()).toHaveAttribute('data-resize-mode', 'border');
    const first = (await left.boundingBox())!;
    expect((await right.boundingBox())!.x).toBeCloseTo(first.x + first.width, 1);
    await expect(left).toHaveAttribute('data-shared-edges', /right/);
    await expect(page.locator('[data-node-id="scene-group"]')).toHaveAttribute(
      'data-shared-edges',
      /left/,
    );
    expect(await split.evaluate((el) => getComputedStyle(el, '::after').width)).toBe('1px');
    expect(await divider.evaluate((el) => getComputedStyle(el, '::before').opacity)).toBe('0');
    await divider.hover();
    expect(await divider.evaluate((el) => getComputedStyle(el, '::before').opacity)).toBe('1');
    await expect(divider).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const corner = left.locator('[data-corner="tr"]');
    expect(
      await corner.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.ownerDocument.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
      }),
    ).toBe(true);
    await divider.focus();
    await expect(divider).toHaveCSS('outline-style', 'none');
    await divider.press('ArrowRight');
    expect((await left.boundingBox())!.width).toBeGreaterThan(first.width);
    const handle = (await divider.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 45, handle.y + handle.height / 2, { steps: 4 });
    await page.mouse.up();
    expect((await left.boundingBox())!.width).toBeGreaterThan(first.width + 20);
    await expect(page.locator('[data-node-id="top"] > .layouts-divider')).toBeHidden();
    const horizontal = page.locator('[data-node-id="timeline-split"] > .layouts-divider');
    await horizontal.focus();
    const y = (await horizontal.boundingBox())!.y;
    await horizontal.press('ArrowUp');
    expect((await horizontal.boundingBox())!.y).toBeLessThan(y);
    if (framework === 'vanilla') {
      await divider.hover();
      await page.screenshot({ path: '/tmp/quilt-border-resize.png' });
    }
    await mode.selectOption('gutter');
    await expect(divider).toHaveCSS('width', '4px');
    await expect(left).not.toHaveAttribute('data-shared-edges', /right/);
    const restored = (await left.boundingBox())!;
    expect((await right.boundingBox())!.x - restored.x - restored.width).toBeCloseTo(4, 1);
  });
}

test('resize mode is live session configuration; disabled borders have no resize target', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const original = await page.evaluate(() =>
    JSON.stringify(window.harness.mounted.exportWorkspace()),
  );
  await page.evaluate(() => window.harness.mounted.updateOptions({ resizeMode: 'border' }));
  expect(await page.evaluate(() => JSON.stringify(window.harness.mounted.exportWorkspace()))).toBe(
    original,
  );
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ capabilities: { defaults: { resize: false } } }),
  );
  await expect(page.getByRole('separator', { includeHidden: true })).toBeHidden();
  await expect(page.locator('[data-node-id="split"]')).toHaveAttribute(
    'data-frozen-border',
    'horizontal',
  );
  const accepted = await page.evaluate(() => {
    try {
      window.harness.mounted.updateOptions({ resizeMode: 'invalid' as 'border' });
      return true;
    } catch {
      return false;
    }
  });
  expect(accepted).toBe(false);
  await expect(page.locator('.layouts')).toHaveAttribute('data-resize-mode', 'border');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ resizeMode: undefined, capabilities: undefined }),
  );
  await expect(page.getByRole('separator')).toHaveCSS('width', '4px');
});

test('React applies and clears the resizeMode prop without remounting content', async ({
  page,
}) => {
  await page.goto('/tests/browser/react-tab-bar.html');
  await page.getByRole('textbox', { name: 'Retained state' }).fill('kept');
  await page.getByRole('button', { name: 'Toggle resize style' }).click();
  await expect(page.locator('.layouts')).toHaveAttribute('data-resize-mode', 'border');
  await page.getByRole('button', { name: 'Toggle resize style' }).click();
  await expect(page.locator('.layouts')).toHaveAttribute('data-resize-mode', 'gutter');
  await expect(page.getByRole('textbox', { name: 'Retained state' })).toHaveValue('kept');
});
