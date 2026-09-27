import { expect } from '@playwright/test';

export async function checkSiteDocs(page, baseURL) {
  await page.goto(baseURL);
  await page.getByRole('link', { name: 'API', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^API reference/ })).toBeVisible();
  await expect(page).toHaveURL(new URL('docs/api-reference/', baseURL).href);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^API reference/ })).toBeVisible();

  for (const [label, name, symbol] of [
    ['Vanilla', 'quilt-vanilla', 'Workspace'],
    ['React', 'quilt-react', 'Workspace'],
    ['Core', 'quilt-core', 'LayoutStore'],
  ]) {
    await page.goto(new URL('docs/api-reference/', baseURL).href);
    await page.locator('.vp-doc').getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await page.locator('.vp-doc').getByRole('link', { name: symbol, exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(symbol);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(symbol);
  }

  // Search must resolve both generated API entries and handwritten guides.
  for (const [query, route] of [
    ['executeAction', /\/docs\/api-reference\//],
    ['Automatic collapse', /\/docs\/lifecycle/],
  ]) {
    await page.goto(baseURL);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('searchbox').fill(query);
    const result = page.locator('.VPLocalSearchBox a.result').filter({ hasText: query }).first();
    await expect(result).toBeVisible();
    await result.click();
    await expect(page).toHaveURL(route);
    await expect(page.locator('.vp-doc')).toContainText(query);
    await page.reload();
    await expect(page.locator('.vp-doc')).toContainText(query);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('searchbox').fill('executeAction');
  const mobileResult = page
    .locator('.VPLocalSearchBox a.result')
    .filter({ hasText: 'executeAction' })
    .first();
  await expect(mobileResult).toBeVisible();
  await mobileResult.click();
  await expect(page).toHaveURL(/\/docs\/api-reference\//);
  await expect(page.locator('.vp-doc')).toContainText('executeAction');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(new URL('docs/api-reference/missing-page', baseURL).href);
  await expect(page.getByText('PAGE NOT FOUND', { exact: true })).toBeVisible();
}
