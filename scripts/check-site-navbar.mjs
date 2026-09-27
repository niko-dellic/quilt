import { expect } from '@playwright/test';

export async function checkSiteNavbar(page, baseURL) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseURL);
  const measure = () =>
    page.locator('.VPNavBar > .wrapper > .container').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, width: rect.width, height: rect.height };
    });
  const home = await measure();
  for (const route of ['vanilla', 'react', 'electron']) {
    await page.goto(new URL(route, baseURL).href);
    await expect(page.locator('.VPNav')).toHaveCount(1);
    expect(await measure()).toEqual(home);
    await page.getByRole('button', { name: 'Demos', exact: true }).click();
    for (const label of ['Vanilla TS', 'React', 'Electron'])
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    const appearance = page.getByRole('switch');
    const wasDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
    await appearance.click();
    await expect(page.locator('html')).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /dark/);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('searchbox').fill('executeAction');
    await page
      .locator('.VPLocalSearchBox a.result')
      .filter({ hasText: 'executeAction' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/docs\/api-reference\//);
    await expect(page.locator('#workspace')).toHaveCount(0);
    await expect(page.locator('.vp-doc')).toContainText('executeAction');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(new URL(route, baseURL).href);
    await page.getByRole('button', { name: 'mobile navigation' }).click();
    await expect(page.locator('.VPNavScreen')).toBeVisible();
    await expect(
      page.locator('.VPNavScreen').getByRole('link', { name: 'Guide', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  // Restore automatic appearance for other site checks.
  await page.evaluate(() => localStorage.removeItem('vitepress-theme-appearance'));
}
