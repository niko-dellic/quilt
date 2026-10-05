import { execFileSync } from 'node:child_process';
import { _electron, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import electron from 'electron';
const packaged = process.argv.includes('--packaged');
const binaries = {
  darwin: `artifacts/desktop/releases/mac${process.arch === 'arm64' ? '-arm64' : ''}/Quilt Demo.app/Contents/MacOS/Quilt Demo`,
  win32: 'artifacts/desktop/releases/win-unpacked/Quilt Demo.exe',
  linux: 'artifacts/desktop/releases/linux-unpacked/quilt-desktop-demo',
};
const executablePath =
  process.env.QUILT_DESKTOP_EXECUTABLE ||
  (packaged ? resolve(binaries[process.platform]) : electron);
if (!existsSync(executablePath)) throw new Error('Desktop executable not found: ' + executablePath);
if (packaged && process.platform === 'darwin') {
  const bundle = executablePath.slice(0, executablePath.indexOf('.app/') + 4);
  execFileSync('codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
}
const app = await _electron.launch({
  executablePath,
  args: packaged ? [] : [resolve('artifacts/desktop/app/main.cjs')],
  timeout: 60000,
});
try {
  const page = await app.firstWindow();
  const errors = [],
    network = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  for (const framework of ['Vanilla TS', 'React']) {
    await page.getByRole('link', { name: framework, exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).toBeVisible();
    await expect(page.locator('.scene-canvas')).toBeVisible();
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    const notes = page.getByRole('textbox', { name: 'Working notes' });
    await notes.fill('Desktop state survives');
    await page.getByRole('button', { name: 'Inspector actions', exact: true }).click();
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Open in window', exact: true }).click();
    const companion = await opened;
    await expect(companion.getByRole('textbox', { name: 'Working notes' })).toHaveValue(
      'Desktop state survives',
    );
    await companion.getByRole('textbox', { name: 'Working notes' }).fill('Returned from desktop');
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByRole('combobox', { name: 'Workspace theme' }).selectOption('zinc-dark');
    await page.getByText('Scrollbars', { exact: true }).click();
    await page.getByLabel('Scrollbar visibility').selectOption('auto-hide');
    await page.getByLabel('Scrollbar placement').selectOption('gutter');
    await expect(companion.locator('.layouts-pane-host').first()).toHaveAttribute(
      'data-quilt-scrollbars',
      'gutter',
    );
    await expect(
      companion.locator('.layouts-pane-host').first().locator(':scope > .os-scrollbar'),
    ).toHaveCount(2);
    await expect(companion.locator('.layouts')).toHaveCSS('--layouts-panel', '#18181b');
    await companion.close();
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await expect(notes).toHaveValue('Returned from desktop');
    const divider = page.locator('[data-node-id="inspector-split"] > [role="separator"]');
    const before = await page.locator('[data-node-id="scene-group"]').boundingBox();
    await divider.focus();
    await page.keyboard.press('ArrowLeft');
    const after = await page.locator('[data-node-id="scene-group"]').boundingBox();
    expect(after.width).toBeLessThan(before.width);
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    const preset = JSON.parse(
      await page.getByRole('textbox', { name: 'Layout JSON' }).inputValue(),
    );
    expect(preset.layout.popouts).toEqual([]);
    expect(preset.scrollbars).toEqual({
      visibility: 'auto-hide',
      placement: 'gutter',
      hideDelay: 500,
      revealOn: 'scroll',
    });
    await page.getByRole('button', { name: 'Load layout', exact: true }).click();
    await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
    await expect(notes).toHaveValue('Returned from desktop');
    console.log(
      `${framework}: packaged showcase, theme, popout/return, resize and workspace JSON passed.`,
    );
  }
  mkdirSync('artifacts/desktop', { recursive: true });
  await page.screenshot({ path: 'artifacts/desktop/screenshot.png' });
  await page.getByRole('button', { name: 'Inspector actions', exact: true }).click();
  const opened = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Open in window', exact: true }).click();
  const companion = await opened;
  await expect(companion.getByRole('textbox', { name: 'Working notes' })).toBeVisible();
  await page.close();
  await expect.poll(() => companion.isClosed()).toBe(true);
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
  console.log('Desktop host cleanup and offline operation passed.');
} finally {
  await app.close();
}
