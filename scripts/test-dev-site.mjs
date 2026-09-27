import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { checkSiteDocs } from './check-site-docs.mjs';
const server = await createServer({ server: { host: 'localhost', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const baseURL = server.resolvedUrls.local[0];
  await checkSiteDocs(page, baseURL);
  await page.goto(baseURL);
  await page.getByRole('link', { name: 'Vanilla TS demo' }).click();
  await expect(page.locator('#workspace .layouts')).toBeVisible();
  await page.reload();
  await expect(page.locator('#workspace .layouts')).toBeVisible();
  expect(errors).toEqual([]);
  console.log('Development API navigation, search results, reloads, and demo navigation passed.');
} finally {
  await browser?.close();
  await server.close();
}
