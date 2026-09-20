import { test, expect } from '@playwright/test';
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: picker searches tab registrations and adds Canvas using the keyboard`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await page.getByRole('button', { name: 'Inspector actions', exact: true }).click();
    await page.getByRole('button', { name: '+ Add tab', exact: true }).click();
    const search = page.getByRole('combobox', { name: 'Search tabs' });
    await expect(search).toBeFocused();
    await search.fill('not a tab');
    await expect(page.getByText('No matching tabs', { exact: true })).toBeVisible();
    await search.fill('viewport');
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Canvas', exact: true })).toBeVisible();
    await search.press('Enter');
    const group = page.locator('[data-node-id="inspector-group"]');
    await expect(group.getByRole('tab', { name: 'Scene', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(group.locator('canvas')).toBeVisible();
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await page.getByRole('button', { name: 'Inspector actions', exact: true }).click();
    await page.getByRole('button', { name: '+ Add tab', exact: true }).click();
    await search.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Notes', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await search.press('Escape');
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).toHaveCount(1);
  });
}
test('registry additions and removals update an open picker; factory errors preserve the layout', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.tabs.register({
      id: 'test',
      title: 'Test view',
      create: () => ({ id: 'c', type: 'test', title: 'C' }),
    });
  });
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await page.getByRole('button', { name: '+ Add tab', exact: true }).click();
  await page.evaluate(() => {
    const remove = window.harness.tabs.register({
      id: 'temporary',
      title: 'Temporary',
      create: () => undefined,
    });
    remove();
    window.harness.tabs.register({
      id: 'invalid',
      title: 'Invalid',
      create: () => ({ id: 'a', type: 'test', title: 'Duplicate' }),
    });
  });
  await expect(page.getByRole('option', { name: 'Temporary', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Invalid', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => Object.keys(window.harness.store.getLayout().panes))).toEqual([
    'a',
    'b',
  ]);
  await page.getByRole('option', { name: 'Test view', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'C', exact: true })).toBeVisible();
});
test('container CSS and live themes propagate to popouts without remounting', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page
    .locator('#host')
    .evaluate((host) => host.style.setProperty('--layouts-header', 'rgb(1, 2, 3)'));
  await expect(page.locator('.layouts-header').first()).toHaveCSS(
    'background-color',
    'rgb(1, 2, 3)',
  );
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await expect(popup.locator('.layouts-companion-bar')).toHaveCSS(
    'background-color',
    'rgb(1, 2, 3)',
  );
  const before = await page.evaluate(() => window.harness.stats.mounts);
  await page.evaluate(() => window.harness.setTheme({ header: 'rgb(4, 5, 6)' }));
  await expect(page.locator('.layouts-header').first()).toHaveCSS(
    'background-color',
    'rgb(4, 5, 6)',
  );
  await expect(popup.locator('.layouts-companion-bar')).toHaveCSS(
    'background-color',
    'rgb(4, 5, 6)',
  );
  expect(await page.evaluate(() => window.harness.stats.mounts)).toBe(before);
  await page.evaluate(() => window.harness.setTheme({}));
  await expect(popup.locator('.layouts-companion-bar')).toHaveCSS(
    'background-color',
    'rgb(1, 2, 3)',
  );
  await popup.close();
});
for (const query of ['', '?no-registry']) {
  test(`populated regions require registered content choices ${query}`, async ({ page }) => {
    await page.goto(`/tests/browser/harness.html${query}`);
    const before = await page.evaluate(() => window.harness.store.exportLayout());
    await page.getByRole('button', { name: 'A actions', exact: true }).click();
    await expect(page.getByRole('button', { name: '+ Add tab', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Split', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => window.harness.store.exportLayout())).toEqual(before);
  });
}
test('a cancelling registry factory leaves existing content unchanged', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() =>
    window.harness.tabs.register({
      id: 'cancel',
      title: 'Cancel creation',
      create: () => undefined,
    }),
  );
  const before = await page.evaluate(() => window.harness.store.exportLayout());
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await page.getByRole('button', { name: '+ Add tab', exact: true }).click();
  await page.getByRole('option', { name: 'Cancel creation', exact: true }).click();
  expect(await page.evaluate(() => window.harness.store.exportLayout())).toEqual(before);
});
