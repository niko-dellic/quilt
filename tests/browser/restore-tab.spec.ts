import { test, expect } from '@playwright/test';
for (const demo of ['vanilla', 'react']) {
  test(`${demo}: menu and R restore closed tabs without intercepting text input`, async ({
    page,
  }) => {
    await page.goto(`/${demo}.html`);
    const scene = page.locator('[data-node-id="scene-group"]');
    const theming = page.locator('[data-node-id="inspector-group"]');
    const sceneTab = scene.getByRole('tab', { name: 'Scene', exact: true });
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Restore closed tab', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Close', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Close active tab', exact: true }).click();
    await expect(sceneTab).toHaveCount(0);
    await theming.getByRole('button', { name: 'Theming actions', exact: true }).click();
    await page.getByRole('button', { name: 'Restore closed tab', exact: true }).click();
    await expect(sceneTab).toBeVisible();
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'Close active tab', exact: true }).click();
    await theming.getByRole('tab', { name: 'Inspector', exact: true }).click();
    const notes = theming.locator('textarea');
    await notes.fill('saved notes');
    await notes.press('r');
    await expect(sceneTab).toHaveCount(0);
    await expect(notes).toHaveValue('saved notesr');
    await theming.getByRole('tab', { name: 'Inspector', exact: true }).focus();
    await page.keyboard.press('r');
    await expect(sceneTab).toBeVisible();
    await expect(notes).toHaveValue('saved notesr');
  });
}
for (const demo of ['vanilla', 'react']) {
  test(`${demo}: Close pane removes the region while Close active tab remains available`, async ({
    page,
  }) => {
    await page.goto(`/${demo}.html`);
    const tools = page.locator('[data-node-id="tools-group"]');
    await tools.getByRole('button', { name: 'Hotkeys actions', exact: true }).click();
    const close = page.getByRole('button', { name: 'Close', exact: true });
    const submenu = page.getByRole('menu', { name: 'Close', exact: true });
    await expect(submenu).toBeHidden();
    await close.focus();
    await page.keyboard.press('ArrowRight');
    await expect(
      submenu.getByRole('menuitem', { name: 'Close active tab', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(submenu).toBeHidden();
    await expect(close).toBeFocused();
    await close.hover();
    await expect(
      page.getByRole('menuitem', { name: 'Close active tab', exact: true }),
    ).toBeVisible();
    await page.getByRole('menuitem', { name: 'Close pane', exact: true }).click();
    await expect(tools).toHaveCount(0);
    await page.keyboard.press('r');
    await page.keyboard.press('r');
    await expect(page.getByRole('tab', { name: 'Hotkeys', exact: true })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Objects', exact: true })).toHaveCount(1);
  });
}
