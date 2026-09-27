import { test, expect } from '@playwright/test';

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: workspace fullscreen preserves views and supports dialogs and exit`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    test.skip(!(await page.evaluate(() => document.fullscreenEnabled)), 'Fullscreen unavailable');
    const canvas = await page.locator('.scene-canvas').elementHandle();
    await page.getByRole('button', { name: 'Enter workspace fullscreen' }).click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.className))
      .toBe('demo-main');
    await expect(page.locator('html')).toHaveCSS('scrollbar-gutter', 'auto');
    const exit = page.getByRole('button', { name: 'Exit workspace fullscreen' });
    await expect(exit).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() =>
        page.locator('.demo-main').evaluate((e) => {
          const rect = e.getBoundingClientRect();
          return [rect.x, rect.y, rect.width - innerWidth, rect.height - innerHeight];
        }),
      )
      .toEqual([0, 0, 0, 0]);
    expect(await canvas!.evaluate((e) => e.isConnected)).toBe(true);
    await page.getByRole('tab', { name: 'Theming', exact: true }).click();
    await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(
      await page.getByRole('dialog').evaluate((e) => document.fullscreenElement?.contains(e)),
    ).toBe(true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await exit.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect(page.getByRole('button', { name: 'Enter workspace fullscreen' })).toBeVisible();
    expect(await canvas!.evaluate((e) => e.isConnected)).toBe(true);
    // Native/browser exits must also update the control, without clicking it.
    await page.getByRole('button', { name: 'Enter workspace fullscreen' }).click();
    await expect(exit).toBeVisible();
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.getByRole('button', { name: 'Enter workspace fullscreen' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test(`${framework}: rejected fullscreen requests leave the workspace usable`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    test.skip(!(await page.evaluate(() => document.fullscreenEnabled)), 'Fullscreen unavailable');
    await page.locator('.demo-main').evaluate((e) => {
      e.requestFullscreen = () => Promise.reject(new Error('Blocked'));
    });
    await page.getByRole('button', { name: 'Enter workspace fullscreen' }).click();
    await expect(
      page.getByRole('button', { name: 'Fullscreen was blocked. Click to try again.' }),
    ).toBeEnabled();
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(page.locator('.scene-canvas')).toBeVisible();
  });
}
