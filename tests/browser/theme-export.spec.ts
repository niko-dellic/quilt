import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: theming pane exports current colors, density, and additional tokens`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await page.getByText('Colors', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Accent', exact: true }).fill('#ab4589');
    await page.getByRole('textbox', { name: 'Accent', exact: true }).press('Tab');
    await expect(page.locator('.layouts')).toHaveCSS('--layouts-accent', '#ab4589');
    await page.getByText('Spacing', { exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Panel padding', exact: true })
      .fill('calc(1rem + 2px)');
    await page.getByRole('textbox', { name: 'Panel padding', exact: true }).press('Tab');
    await page.getByText('Scrollbars', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Scrollbar size', exact: true }).fill('9px');
    await page.getByRole('textbox', { name: 'Scrollbar size', exact: true }).press('Tab');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export theme', exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('quilt-theme.json');
    const theme = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(theme).toMatchObject({
      accent: '#ab4589',
      panelPadding: 'calc(1rem + 2px)',
      scrollbarSize: '9px',
      fontSize: '11px',
      headerHeight: '32px',
    });
    expect(theme).not.toHaveProperty('layout');
    await page.getByRole('combobox', { name: 'Workspace theme' }).selectOption('mist-light');
    await expect(page.getByRole('textbox', { name: 'Accent', exact: true })).toHaveValue('#28647b');
    await expect(page.getByRole('textbox', { name: 'Panel padding', exact: true })).toHaveValue(
      'calc(1rem + 2px)',
    );
  });
  test(`${framework}: invalid CSS preserves applied theme and exported workspace loads export exactly`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await page.getByText('Colors', { exact: true }).click();
    const accent = page.getByRole('textbox', { name: 'Accent', exact: true });
    const initial = await accent.inputValue();
    await accent.fill('not-a-color');
    await accent.press('Tab');
    await expect(accent).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.layouts')).toHaveCSS('--layouts-accent', initial);
    await accent.fill('#123456');
    await accent.press('Tab');
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    const field = page.getByRole('textbox', { name: 'Layout JSON' });
    const preset = JSON.parse(await field.inputValue());
    preset.theme = { accent: '#654321', panelPadding: '14px' };
    await field.fill(JSON.stringify(preset));
    await page.getByRole('button', { name: 'Load layout', exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export theme', exact: true }).click();
    const download = await pending;
    expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(preset.theme);
    await expect(page.locator('a[href="/themes.html"]')).toHaveCount(0);
  });
}

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: frozen border has inherited, custom, and hidden colors`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    await page.getByText('Colors', { exact: true }).click();
    const colors = page.getByRole('region', { name: 'Colors', exact: true });
    const mode = colors.getByRole('combobox', { name: 'Frozen border', exact: true });
    const picker = colors.getByLabel('Frozen border color', { exact: true });
    await expect(mode).toHaveValue('inherit');
    await expect(picker).toBeHidden();
    await expect(
      page
        .getByRole('region', { name: 'Resizing', exact: true })
        .getByLabel('Frozen border', { exact: true }),
    ).toHaveCount(0);
    await mode.selectOption('custom');
    await expect(picker).toHaveAttribute('type', 'color');
    await picker.fill('#c04589');
    const boundary = page.locator('[data-node-id="top"]');
    const color = () => boundary.evaluate((el) => getComputedStyle(el, '::after').backgroundColor);
    await expect.poll(color).toBe('rgb(192, 69, 137)');
    await mode.selectOption('hidden');
    await expect(picker).toBeHidden();
    await expect.poll(color).toBe('rgba(0, 0, 0, 0)');
    await mode.selectOption('custom');
    await expect(picker).toHaveValue('#c04589');
    await mode.selectOption('inherit');
    const border = colors.getByRole('textbox', { name: 'Border', exact: true });
    await border.fill('#123456');
    await border.press('Tab');
    await expect.poll(color).toBe('rgb(18, 52, 86)');
  });
}
