import { allowCanvasTabs } from './demo-helpers';
import { test, expect } from '@playwright/test';
for (const demo of ['vanilla', 'react']) {
  test(`${demo}: display works in both orientations and saves per-region overrides`, async ({
    page,
  }) => {
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
    const theming = page.locator('[data-node-id="inspector-group"]');
    const tab = scene.getByRole('tab', { name: 'Scene', exact: true });
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Tab display', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Compact', exact: true }).click();
    await expect(scene).toHaveAttribute('data-tab-display', 'compact');
    await expect(theming).toHaveAttribute('data-tab-display', 'automatic');
    await expect(scene.locator('.layouts-tab-label')).toBeHidden();
    await tab.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Scene');
    const tabBounds = (await tab.boundingBox())!;
    const tooltipBounds = (await page.getByRole('tooltip').boundingBox())!;
    expect(tooltipBounds.y).toBeCloseTo(tabBounds.y + tabBounds.height + 8, 0);
    expect(tooltipBounds.x + tooltipBounds.width / 2).toBeCloseTo(
      tabBounds.x + tabBounds.width / 2,
      0,
    );
    await page.getByRole('combobox', { name: 'Tab orientation', exact: true }).selectOption('left');
    await expect(theming).toHaveAttribute('data-tab-placement', 'left');
    const verticalCloses = theming.locator(
      '.layouts-tab-item[data-active="true"] > .layouts-tab-close',
    );
    await expect(
      theming.locator('.layouts-tab-item:not([data-active="true"]) > .layouts-tab-close:visible'),
    ).toHaveCount(0);
    for (const close of await verticalCloses.all()) {
      await expect(close).toBeVisible();
      const bounds = (await close.boundingBox())!;
      const header = (await theming.locator(':scope > header').boundingBox())!;
      const tabBounds = (await close.locator('..').locator('.layouts-tab').boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(tabBounds.y + tabBounds.height - 0.5);
      expect(bounds.x + bounds.width / 2).toBeCloseTo(tabBounds.x + tabBounds.width / 2, 0);
      expect(bounds.x).toBeGreaterThanOrEqual(header.x);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(header.x + header.width);
    }
    await theming.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await expect(theming.locator('.layouts-tab-close:visible')).toHaveCount(1);
    await expect(
      theming.locator('.layouts-tab-item[data-active="true"] > .layouts-tab-close'),
    ).toBeVisible();
    await theming.getByRole('tab', { name: 'Theming', exact: true }).click();
    await expect(scene.locator('.layouts-tab-close')).toBeHidden();
    await page.getByRole('slider', { name: 'Tab width', exact: true }).fill('180');
    await expect(theming.locator('.layouts-tab-label').first()).toBeVisible();
    await expect(scene.locator('.layouts-tab-label')).toBeHidden();
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    const json = page.getByRole('textbox', { name: 'Layout JSON', exact: true });
    expect(await json.inputValue()).toContain('"tabDisplay": "compact"');
    await page.locator('#json-load').click();
    await expect(scene).toHaveAttribute('data-tab-display', 'compact');
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Tab display', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Workspace default', exact: true }).click();
    await expect(scene).toHaveAttribute('data-tab-display', 'automatic');
    await expect(scene.locator('.layouts-tab-label')).toBeVisible();
    await expect(scene.locator('.layouts-tab-close')).toBeVisible();
    await scene.locator('.layouts-tab-close').click();
    await expect(scene.getByRole('tab', { name: 'Scene', exact: true })).toHaveCount(0);
  });
}
