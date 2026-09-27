import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

// Exercise the merged production output, including navigation out of VitePress.
const server = await preview({ preview: { host: 'localhost', port: 0 } });
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const baseURL = server.resolvedUrls.local[0];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  for (const [route, label] of [
    ['vanilla', 'Vanilla TS demo'],
    ['react', 'React demo'],
  ]) {
    await page.goto(baseURL);
    await page.getByRole('link', { name: label }).click();
    await expect(page.locator('#workspace .layouts')).toBeVisible();
    await expect(page).toHaveURL(new URL(route, baseURL).href);
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    await expect(page.locator('#json-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await expect(page.locator('#workspace .layouts')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Workspace layouts' })).toBeVisible();
  }

  await page.goto(new URL('docs/', baseURL).href);
  await page.getByRole('link', { name: 'Demos', exact: true }).click();
  await expect(page.locator('#workspace .layouts')).toBeVisible();
  await page.goto(baseURL);
  await page.getByRole('link', { name: 'Desktop demo' }).click();
  await expect(page).toHaveTitle(/Desktop demo/);

  await page.goto(baseURL);
  for (const [label, command] of [
    ['Vanilla TS', 'npm install quilt-vanilla'],
    ['React', 'npm install quilt-react'],
  ]) {
    await expect(page.locator('pre code').filter({ hasText: command })).toBeVisible();
    const copy = page.getByRole('button', { name: `Copy ${label} install command` });
    await copy.click();
    await expect(copy).toHaveText('Copied!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  }
  await context.clearPermissions();
  await context.grantPermissions([]);
  await page.getByRole('button', { name: 'Copy React install command' }).click();
  await expect(page.getByRole('status')).toContainText('Could not copy');

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: 'Copy React install command' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  expect(errors).toEqual([]);
  console.log('Production demo navigation, reloads, install copying, and mobile layout passed.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
