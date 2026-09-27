import { test, expect } from '@playwright/test';

for (const demo of ['vanilla', 'react']) {
  test(`${demo}: settings actions never flash in the header during startup`, async ({ page }) => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/demos/${demo}.${demo === 'react' ? 'tsx' : 'ts'}`, async (route) => {
      await ready;
      await route.continue();
    });
    try {
      await page.goto(`/${demo}.html`, { waitUntil: 'commit' });
      await expect(page.locator('.VPNav')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Layout JSON', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0);
    } finally {
      release();
    }
    const settings = page.locator('.demo-theming');
    await expect(settings.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
    await settings.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    await expect(page.locator('#json-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await settings.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Layout JSON', exact: true })).toBeVisible();
    await expect(page.locator('.VPNav #json-open, .VPNav #reset')).toHaveCount(0);
  });
}
