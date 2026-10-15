import { allowCanvasTabs } from './demo-helpers';
import { test, expect } from '@playwright/test';
for (const demo of ['vanilla', 'react']) {
  test(`${demo}: floating controls, fit and orientation`, async ({ page }) => {
    await page.goto(`/${demo}.html`);
    await allowCanvasTabs(page);
    const scene = page.locator('[data-node-id="scene-group"]');
    // Exercise workspace orientation without the demo's persisted Scene override.
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Tab orientation', exact: true }).click();
    await page
      .getByRole('menu', { name: 'Tab orientation', exact: true })
      .getByRole('menuitemradio', { name: 'Workspace default', exact: true })
      .click();
    const header = scene.locator(':scope > header');
    const body = scene.locator(':scope > .layouts-body');
    const original = await body.boundingBox();
    const orientation = page.getByRole('combobox', { name: 'Tab orientation', exact: true });
    const placement = page.getByRole('combobox', { name: 'Tab placement', exact: true });
    await expect(placement).toHaveValue('floating');
    await expect(page.getByRole('combobox', { name: 'Fit', exact: true })).toHaveValue('fit');
    await expect(page.getByRole('combobox', { name: 'Taper options' })).toBeHidden();
    for (const direction of ['top', 'left']) {
      await orientation.selectOption(direction);
      for (const fit of ['fit', 'full']) {
        await page.getByRole('combobox', { name: 'Fit', exact: true }).selectOption(fit);
        for (const corner of ['fitted', 'rounded', 'capsule']) {
          await page.getByRole('combobox', { name: 'Corner type' }).selectOption(corner);
          await expect(scene).toHaveAttribute('data-tab-attachment', 'floating');
          await expect(header).toHaveAttribute('data-tab-corners', corner);
          await expect
            .poll(async () => {
              const h = (await header.boundingBox())!;
              const r = (await scene.boundingBox())!;
              return Math.round(h.x - r.x);
            })
            .toBe(8);
          const h = (await header.boundingBox())!;
          const r = (await scene.boundingBox())!;
          expect(h.y - r.y).toBeCloseTo(8, 0);
          expect(h.x + h.width).toBeLessThanOrEqual(r.x + r.width - 7);
          expect(h.y + h.height).toBeLessThanOrEqual(r.y + r.height - 7);
          if (fit === 'full') {
            expect(direction === 'top' ? h.width : h.height).toBeCloseTo(
              (direction === 'top' ? r.width : r.height) - 16,
              0,
            );
          }
          expect(await body.boundingBox()).toEqual(original);
        }
      }
    }
    await placement.selectOption('anchored');
    await expect(page.getByRole('combobox', { name: 'Fit', exact: true })).toBeHidden();
    await page.getByRole('combobox', { name: 'Taper options' }).selectOption('rounded');
    await expect(header).toHaveCSS('border-radius', '5px');
    await expect(scene).toHaveAttribute('data-tab-attachment', 'anchored');
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Scene actions' })).toBeVisible();
  });
}

for (const demo of ['vanilla', 'react']) {
  test(`${demo}: floating bars clear content scrollbars and react to overflow changes`, async ({
    page,
  }) => {
    await page.goto(`/${demo}.html`);
    await allowCanvasTabs(page);
    await page.getByRole('combobox', { name: 'Fit', exact: true }).selectOption('full');
    const region = page.locator('[data-node-id="inspector-group"]');
    const header = region.locator(':scope > header');
    const content = region.locator('.demo-theming .demo-actions');
    await content.evaluate((el) => {
      (el as HTMLElement).style.minHeight = '2000px';
    });
    const gap = async () => {
      const r = (await region.boundingBox())!;
      const h = (await header.boundingBox())!;
      return r.x + r.width - h.x - h.width;
    };
    await expect.poll(gap).toBeGreaterThanOrEqual(14);
    await expect
      .poll(async () => {
        const r = (await region.boundingBox())!;
        const h = (await header.boundingBox())!;
        return h.x - r.x;
      })
      .toBe(8);
    // Removing overflow must release the reserved scrollbar space.
    await content.evaluate((el) => {
      (el as HTMLElement).style.display = 'none';
    });
    await expect.poll(async () => Math.round(await gap())).toBe(8);
  });
}
