import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { themeProperties } from 'quilt-vanilla';

test('theme builder edits, exports and imports a reusable theme without remounting content', async ({
  page,
}) => {
  await page.goto('/themes.html');
  const root = page.locator('#theme-preview .layouts');
  const notes = page.getByRole('textbox', { name: 'Preview notes' }).filter({ visible: true });
  await notes.fill('Keep my draft');
  for (const key of Object.keys(themeProperties))
    await expect(page.locator(`input[aria-label="${key}"]`)).toHaveCount(1);
  await page.getByLabel('accent', { exact: true }).fill('#ab4589');
  await expect(root).toHaveCSS('--layouts-accent', '#ab4589');
  await expect(notes).toHaveValue('Keep my draft');
  await page.getByText('Typography & spacing', { exact: true }).click();
  await page.getByLabel('headerHeight', { exact: true }).fill('calc(2rem + 8px)');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export theme' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('quilt-theme.json');
  const content = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(content)).toMatchObject({
    accent: '#ab4589',
    headerHeight: 'calc(2rem + 8px)',
  });
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.locator('#theme-file').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
  await expect(page.getByRole('status')).toHaveText('Imported roundtrip.json.');
  expect(JSON.parse((await page.locator('#theme-json').textContent())!)).toEqual(
    JSON.parse(content),
  );
  await expect(notes).toHaveValue('Keep my draft');
  await page.getByRole('button', { name: 'Notes actions', exact: true }).click();
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open in window', exact: true }).click();
  const popup = await popupEvent;
  await expect(popup.getByRole('textbox', { name: 'Preview notes' })).toHaveValue('Keep my draft');
  await page.getByLabel('accent', { exact: true }).fill('#123456');
  await expect(popup.locator('.layouts-companion')).toHaveCSS('--layouts-accent', '#123456');
  await popup.close();
});

test('theme imports fail atomically and invalid editor values cannot be exported', async ({
  page,
}) => {
  await page.goto('/themes.html');
  const initial = await page.locator('#theme-json').textContent();
  for (const content of [
    '{',
    'null',
    '[]',
    '{"accent":42}',
    '{"unknown":"red"}',
    '{"accent":"not-a-color"}',
    '{"layout":{}}',
  ]) {
    await page.locator('#theme-file').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });
    await expect(page.getByRole('status')).toContainText('Import failed:');
    await expect(page.locator('#theme-json')).toHaveText(initial!);
  }
  await page.getByLabel('accent', { exact: true }).fill('bad-value');
  await expect(page.getByRole('button', { name: 'Export theme' })).toBeDisabled();
  await expect(page.locator('#theme-json')).toHaveText(initial!);
  await page.getByLabel('accent', { exact: true }).fill('var(--brand-color, #123456)');
  await expect(page.getByRole('button', { name: 'Export theme' })).toBeEnabled();
  await page
    .locator('#theme-file')
    .setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('#theme-json')).toHaveText('{}');
  await expect(page.getByLabel('accent', { exact: true })).toHaveValue('');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
