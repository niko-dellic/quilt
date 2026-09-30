import { test, expect } from '@playwright/test';
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: resize handle settings update gaps without changing layout JSON`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('combobox', { name: 'Resize style', exact: true }).selectOption('gutter');
    const readJSON = async () => {
      await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
      const value = await page
        .getByRole('textbox', { name: 'Layout JSON', exact: true })
        .inputValue();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      return JSON.stringify(JSON.parse(value).layout);
    };
    const originalJSON = await readJSON();
    const top = page.locator('[data-node-id="top"] > .layouts-divider');
    const bottom = page.locator('[data-node-id="footer-split"] > .layouts-divider');
    await expect(top).toBeHidden();
    await expect(bottom).toBeHidden();
    const staticPane = page.locator('[data-node-id="toolbar-group"]');
    const next = page.locator('[data-node-id="footer-split"]');
    const first = (await staticPane.boundingBox())!;
    expect((await next.boundingBox())!.y).toBeCloseTo(first.y + first.height, 1);
    const resizing = page.getByRole('region', { name: 'Resizing', exact: true });
    await expect(resizing.getByRole('slider', { name: 'Resize handle width' })).toBeVisible();
    await expect(resizing.getByRole('checkbox')).toHaveCount(1);
    const boundary = page.locator('[data-node-id="top"]');
    const border = () =>
      boundary.evaluate((element) => {
        const css = getComputedStyle(element, '::after');
        return { color: css.backgroundColor, height: css.height, events: css.pointerEvents };
      });
    expect(await border()).toMatchObject({ height: '1px', events: 'none' });
    for (const theme of ['neutral-light', 'neutral-dark']) {
      await page.getByRole('combobox', { name: 'Workspace theme' }).selectOption(theme);
      expect((await border()).color).toBe(
        theme === 'neutral-light' ? 'rgb(212, 212, 212)' : 'rgb(82, 82, 82)',
      );
    }
    expect(await staticPane.boundingBox()).toEqual(first);
    await page
      .getByRole('combobox', { name: 'Tab placement', exact: true })
      .selectOption('anchored');
    const scene = page.locator('[data-node-id="scene-group"]');
    for (const placement of ['top', 'left']) {
      await page
        .getByRole('combobox', { name: 'Tab orientation', exact: true })
        .selectOption(placement);
      for (const shape of ['angle', 'round', 'scoop', 'vertical', 'full']) {
        await page.getByRole('combobox', { name: 'Taper options' }).selectOption(shape);
        await expect(scene).toHaveAttribute('data-shared-edges', /top/);
        expect(
          await scene.evaluate((el) =>
            getComputedStyle(el).getPropertyValue('--layouts-edge-top').trim(),
          ),
        ).toBe('transparent');
        if (shape !== 'full') {
          await expect(scene.locator('.layouts-tab-outline')).toHaveCSS('clip-path', /^inset\(1px/);
        }
      }
    }
    await page.getByRole('combobox', { name: 'Tab orientation', exact: true }).selectOption('top');
    const toggle = page.getByRole('checkbox', { name: 'Show disabled resize handles' });
    await expect(toggle).not.toBeChecked();
    const width = page.getByRole('slider', { name: 'Resize handle width' });
    await width.focus();
    await width.press('ArrowRight');
    await expect(page.locator('[data-node-id="tools-split"] > .layouts-divider')).toHaveCSS(
      'width',
      '5px',
    );
    await toggle.check();
    await expect(top).toBeVisible();
    await expect(boundary).toHaveAttribute('data-frozen-border', '');
    await expect(scene).not.toHaveAttribute('data-shared-edges', /top/);
    await expect(top).toHaveCSS('height', '5px');
    await expect(top).toHaveAttribute('aria-disabled', 'true');
    await top.focus();
    await top.press('ArrowDown');
    expect((await staticPane.boundingBox())!.height).toBe(first.height);
    await toggle.uncheck();
    await expect(top).toBeHidden();
    await expect(bottom).toBeHidden();
    await expect(boundary).toHaveAttribute('data-frozen-border', 'vertical');
    expect((await border()).color).toBe('rgb(82, 82, 82)');
    expect(await readJSON()).toBe(originalJSON);
  });
}
