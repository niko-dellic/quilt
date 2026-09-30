import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${framework}: defaults to neutral ${colorScheme} from system preference`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/${framework}.html`);
      const theme = page.getByRole('combobox', { name: 'Workspace theme' });
      await expect(theme).toHaveValue(`neutral-${colorScheme}`);
      const panel = colorScheme === 'dark' ? 'rgb(23, 23, 23)' : 'rgb(255, 255, 255)';
      await expect(page.locator('html')).toHaveCSS('background-color', panel);
      await expect(page.locator('.layouts')).toHaveCSS(
        '--layouts-panel',
        colorScheme === 'dark' ? '#171717' : '#ffffff',
      );
      await theme.selectOption('mist-light');
      await page.emulateMedia({ colorScheme: colorScheme === 'dark' ? 'light' : 'dark' });
      await expect(theme).toHaveValue('mist-light');
      await expect(page.locator('html')).toHaveCSS('color', 'rgb(25, 44, 53)');
      await expect(page.locator('.layouts')).toHaveCSS('--layouts-text', '#192c35');
    });
  }

  test(`${framework}: theme covers the page, controls, dialog, and scene`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const theme = page.getByRole('combobox', { name: 'Workspace theme' });
    const canvas = page.locator('.scene-canvas');
    await expect(canvas).toBeVisible();
    const initial = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
    await theme.selectOption('zinc-dark');
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
    await expect(page.locator('html')).toHaveCSS('color', 'rgb(250, 250, 250)');
    await expect(theme).toHaveCSS('background-color', 'rgb(24, 24, 27)');
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .not.toBe(initial);
    const controls = page
      .locator('.demo-theming .demo-actions')
      .locator('button:visible, select:visible');
    const heights = await controls.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await theme.selectOption('mist-light');
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('html')).toHaveCSS('color', 'rgb(25, 44, 53)');
    await page.setViewportSize({ width: 600, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      600,
    );
  });

  test(`${framework}: surface colors follow the theme and retain selection across popouts`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const theme = page.getByRole('combobox', { name: 'Workspace theme' });
    await theme.selectOption('neutral-light');
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    const blue = page.getByRole('button', { name: 'Use blue surface', exact: true });
    await blue.click();
    await expect(blue).toHaveAttribute('aria-pressed', 'true');
    const lightSwatch = await blue.evaluate((element) => getComputedStyle(element).backgroundColor);
    const canvas = page.locator('.scene-canvas');
    const lightScene = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await theme.selectOption('neutral-dark');
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await expect(blue).not.toHaveCSS('background-color', lightSwatch);
    await expect(blue).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
      .not.toBe(lightScene);
    await page.getByRole('button', { name: 'Inspector actions', exact: true }).click();
    const popupEvent = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open in window', exact: true }).click();
    const popup = await popupEvent;
    const popupBlue = popup.getByRole('button', { name: 'Use blue surface', exact: true });
    await expect(popupBlue).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await theme.selectOption('neutral-light');
    await expect(popupBlue).toHaveCSS('background-color', lightSwatch);
    await popup.getByRole('button', { name: 'Use purple surface', exact: true }).click();
    await popup.close();
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Use purple surface', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test(`${framework}: settings open by default and return on reset`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const hotkeys = page.getByRole('tab', { name: 'Hotkeys', exact: true });
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page
        .locator('[data-node-id="tools-group"]')
        .getByRole('tab', { name: 'Settings', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page
        .locator('[data-node-id="tools-group"]')
        .getByRole('tab', { name: 'Objects', exact: true }),
    ).toHaveAttribute('aria-selected', 'false');
    await expect(
      page
        .locator('[data-node-id="timeline-group"]')
        .getByRole('tab', { name: 'Timeline', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await hotkeys.click();
    await expect(page.getByText('` or Alt + Space', { exact: true })).toBeVisible();
    await hotkeys.hover();
    await page.keyboard.press('Alt+Space');
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).not.toBeVisible();
    await page.keyboard.press('Alt+Space');
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close Hotkeys', exact: true }).click();
    await expect(hotkeys).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: taper slider updates geometry and remembers shape values`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await page
      .getByRole('combobox', { name: 'Tab placement', exact: true })
      .selectOption('anchored');
    const style = page.getByRole('combobox', { name: 'Taper options' });
    const angle = page.getByRole('slider', { name: 'Angle', exact: true });
    await expect(angle).toHaveValue('60');
    await angle.focus();
    await angle.press('ArrowRight');
    await expect
      .poll(async () =>
        parseFloat(
          await page
            .locator('.layouts-tab-cap')
            .last()
            .evaluate((el) => getComputedStyle(el).width),
        ),
      )
      .toBeCloseTo(32 / Math.tan((61 * Math.PI) / 180), 1);
    await expect(angle).toHaveAttribute('aria-valuetext', '61 degrees');
    await style.selectOption('scoop');
    const scoop = page.getByRole('slider', { name: 'Scoop width' });
    await scoop.focus();
    await scoop.press('ArrowRight');
    await expect(page.locator('.layouts-tab-cap').last()).toHaveCSS('width', '33px');
    await style.selectOption('vertical');
    await expect(scoop).toBeHidden();
    await style.selectOption('angle');
    await expect(angle).toHaveValue('61');
    await style.selectOption('scoop');
    await expect(scoop).toHaveValue('33');
    await expect(scoop.locator('..')).toContainText('Scoop width: 33px');
    await expect(page.getByRole('slider', { name: 'Tab height', exact: true })).toHaveValue('32');
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: theming pane owns controls and preserves settings on reset`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await expect(page.getByRole('tab', { name: 'Theming', exact: true })).toBeVisible();
    await expect(page.locator('.VPNav #json-open, .VPNav #reset, .VPNav select')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Active tab underline' })).toHaveCount(0);
    const activeTab = page.locator(
      '[data-node-id="inspector-group"] .layouts-tab-item[data-active="true"]',
    );
    await expect(activeTab).toHaveCSS('box-shadow', 'none');
    const height = page.getByRole('slider', { name: 'Tab height', exact: true });
    await height.focus();
    await height.press('ArrowRight');
    await expect(page.locator('.layouts')).toHaveCSS('--layouts-header-height', '33px');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(height).toHaveValue('33');
    await expect(page.getByRole('tab', { name: 'Theming', exact: true })).toBeVisible();
  });
}
