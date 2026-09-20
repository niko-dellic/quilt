import { test, expect } from '@playwright/test';
test('corner split, escape cancellation and sibling join preserve panes', async ({ page }) => {
  await page.goto('/vanilla.html');
  const source = page.locator('[data-node-id="scene-group"]');
  await expect(source).toBeVisible();
  const box = (await source.boundingBox())!;
  const handle = source.locator('[data-corner="tl"]');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 8);
  await expect(page.locator('[data-corner-preview=split]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 8);
  const preview = (await page.locator('[data-corner-preview=split]').boundingBox())!;
  await page.mouse.up();
  const empty = page.locator('.layouts-group').filter({ has: page.locator('.layouts-empty') });
  await expect(empty).toBeVisible();
  const bounds = (await empty.boundingBox())!;
  expect(Math.abs(bounds.width - preview.width)).toBeLessThan(2);
  const picker = (await page.getByRole('dialog', { name: 'Choose a tab' }).boundingBox())!;
  expect(Math.abs(picker.x + picker.width / 2 - bounds.x - bounds.width / 2)).toBeLessThan(2);
  expect(picker.y).toBeGreaterThan(bounds.y);
  expect(picker.y + picker.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  await page.getByRole('option', { name: 'Notes', exact: true }).click();
  const notes = page
    .getByRole('tab', { name: 'Notes', exact: true })
    .locator('xpath=ancestor::section[1]');
  const next = (await source.boundingBox())!;
  await notes.locator('[data-corner="tr"]').hover();
  await page.mouse.down();
  await page.mouse.move(next.x + next.width / 2, next.y + 30);
  await expect(page.locator('[data-corner-preview=join-source]')).toContainText('Joins Scene');
  await expect(page.locator('[data-corner-preview=join-target]')).toContainText(
    'Scene absorbs Notes',
  );
  await expect(page.locator('[data-corner-preview=join]')).toBeVisible();
  await page.mouse.up();
  await expect(source.getByRole('tab', { name: 'Notes', exact: true })).toBeVisible();
  await expect(source.getByRole('tab', { name: 'Scene', exact: true })).toBeVisible();
});
test('split orientation follows the gesture; cancelling the picker removes only the empty region', async ({
  page,
}) => {
  await page.goto('/vanilla.html');
  await page.getByRole('combobox', { name: 'Auto collapse', exact: true }).selectOption('enabled');
  const source = page.locator('[data-node-id="scene-group"]');
  const before = (await source.boundingBox())!;
  await source.locator('[data-corner="tl"]').hover();
  await page.mouse.down();
  await page.mouse.move(before.x + 140, before.y + 30);
  let preview = (await page.locator('[data-corner-preview=split]').boundingBox())!;
  expect(preview.height).toBeCloseTo(before.height, 0);
  await page.mouse.move(before.x + 30, before.y + 140);
  preview = (await page.locator('[data-corner-preview=split]').boundingBox())!;
  expect(preview.width).toBeCloseTo(before.width, 0);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Choose a tab' })).toBeVisible();
  expect((await source.boundingBox())!.height).toBeLessThan(before.height);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await source.boundingBox())!.height).toBeCloseTo(before.height, 0);
});
test('an empty region restored from JSON can still choose content', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const store = window.harness.store;
    store.splitGroup('left', 'horizontal', null);
    store.loadLayout(store.exportLayout());
  });
  await page.getByRole('button', { name: 'Choose a tab', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Search tabs' })).toBeFocused();
});
