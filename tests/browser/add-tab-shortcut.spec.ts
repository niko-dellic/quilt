import { test, expect, type Page } from '@playwright/test';
// Inspect cancellation directly as well as exercising browser keyboard input.
const press = (page: Page) =>
  page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 't',
      code: 'KeyT',
      bubbles: true,
      cancelable: true,
    });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event.defaultPrevented;
  });
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: T opens a pane tab without opening a browser tab`, async ({
    page,
    context,
  }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Hotkeys', exact: true }).hover();
    const pagesBefore = context.pages().length;
    await page.keyboard.press('t');
    const search = page.getByRole('combobox', { name: 'Search tabs' });
    await expect(search).toBeFocused();
    await search.fill('viewport');
    await search.press('Enter');
    await expect(
      page.locator('[data-node-id="tools-group"]').getByRole('tab', { name: 'Scene', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(context.pages()).toHaveLength(pagesBefore);
  });
  test(`${framework}: T opens the hovered region picker and prevents default`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Scene', exact: true }).focus();
    await page.getByRole('tab', { name: 'Hotkeys', exact: true }).hover();
    expect(await press(page)).toBe(true);
    const search = page.getByRole('combobox', { name: 'Search tabs' });
    await expect(search).toBeFocused();
    expect(await press(page)).toBe(false);
    await search.fill('viewport');
    await search.press('Enter');
    await expect(
      page.locator('[data-node-id="tools-group"]').getByRole('tab', { name: 'Scene', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
  });
}
test('T respects opt-in, focus fallback, text entry, and move capabilities', async ({ page }) => {
  for (const enabled of [false, true]) {
    await page.goto(`/tests/browser/harness.html${enabled ? '?shortcuts' : ''}`);
    await page.evaluate(() =>
      window.harness.tabs.register({
        id: 'new',
        title: 'New view',
        create: () => ({ id: 'c', type: 'test', title: 'C' }),
      }),
    );
    const tab = page.getByRole('tab', { name: 'A', exact: true });
    await tab.hover();
    if (!enabled) {
      expect(await press(page)).toBe(false);
      continue;
    }
    await page.getByRole('textbox', { name: 'A', exact: true }).focus();
    expect(await press(page)).toBe(false);
    await tab.focus();
    await page.mouse.move(950, 650);
    expect(await press(page)).toBe(true);
    await page.getByRole('combobox', { name: 'Search tabs' }).press('Escape');
    await tab.focus();
    await tab.hover();
    await page.evaluate(() =>
      window.harness.store.updatePane({
        ...window.harness.store.getLayout().panes.a!,
        capabilities: { move: false },
      }),
    );
    expect(await press(page)).toBe(false);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
