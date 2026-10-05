import { test, expect } from '@playwright/test';
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: orientation submenu shows overrides and supports pointer and keyboard navigation`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const scene = page.locator('[data-node-id="scene-group"]');
    const actions = scene.getByRole('button', { name: 'Scene actions', exact: true });
    const orientation = page.getByRole('button', { name: 'Tab orientation', exact: true });
    const menu = page.getByRole('menu', { name: 'Tab orientation', exact: true });
    await actions.click();
    await expect(page.locator('dialog.layouts-menu')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '+ Add tab', exact: true })).toBeFocused();
    const labels = await page
      .locator('dialog.layouts-menu > button, dialog.layouts-menu > .layouts-submenu > button')
      .evaluateAll((buttons) =>
        buttons.map((button) =>
          Array.from(button.childNodes)
            .filter((node) => !(node instanceof Element && node.matches('.layouts-shortcut')))
            .map((node) => node.textContent)
            .join(''),
        ),
      );
    expect(labels.map((label) => label.trim())).toEqual([
      'Add tab',
      'Split ▸',
      'Join sibling region',
      'Maximize region',
      'Open in window',
      'Tab orientation ▸',
      'Tab display ▸',
      'Close ▸',
      'Restore closed tab',
      'Cancel',
    ]);
    await expect(menu).toBeHidden();
    await orientation.hover();
    await expect(menu.getByRole('menuitemradio', { name: 'Vertical', exact: true })).toBeChecked();
    for (const [value, label] of [
      ['left', 'Vertical'],
      ['top', 'Horizontal'],
      ['', 'Workspace default'],
    ] as const) {
      await menu.getByRole('menuitemradio', { name: label, exact: true }).click();
      await expect(scene).toHaveAttribute('data-tab-placement', value || 'top');
      await actions.click();
      await expect(orientation).not.toBeFocused();
      await orientation.hover();
      await expect(menu.getByRole('menuitemradio', { name: label, exact: true })).toBeChecked();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.layouts-menu')).toHaveCount(0);
    await actions.focus();
    await page.keyboard.press('Enter');
    await orientation.focus();
    await page.keyboard.press('ArrowRight');
    await expect(
      menu.getByRole('menuitemradio', { name: 'Workspace default', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(menu).toBeHidden();
    await expect(orientation).toBeFocused();
    // A layout-driven pointerenter must not undo the keyboard close.
    await orientation.locator('..').dispatchEvent('pointerenter');
    await expect(menu).toBeHidden();
    await page.mouse.move(0, 0);
    await orientation.hover();
    await expect(menu).toBeVisible();
  });

  test(`${framework}: per-region orientation survives JSON loading`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const scene = page.locator('[data-node-id="scene-group"]');
    const tools = page.locator('[data-node-id="tools-group"]');
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Tab orientation', exact: true }).hover();
    await page.getByRole('menuitemradio', { name: 'Vertical', exact: true }).click();
    await expect(scene).toHaveAttribute('data-tab-placement', 'left');
    await expect(tools).toHaveAttribute('data-tab-placement', 'top');
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    const json = page.getByRole('textbox', { name: 'Layout JSON', exact: true });
    const saved = await json.inputValue();
    expect(saved).toContain('"tabPlacement": "left"');
    await page.locator('#json-load').click();
    await expect(scene).toHaveAttribute('data-tab-placement', 'left');
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Tab orientation', exact: true }).hover();
    await page.getByRole('menuitemradio', { name: 'Horizontal', exact: true }).click();
    await expect(scene).toHaveAttribute('data-tab-placement', 'top');
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    await json.fill(saved);
    await page.locator('#json-load').click();
    await expect(scene).toHaveAttribute('data-tab-placement', 'left');
  });
}
