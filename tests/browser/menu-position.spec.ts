import { expect, test, type Locator } from '@playwright/test';

async function expectOnScreen(element: Locator) {
  await expect(element).toBeVisible();
  await expect
    .poll(async () =>
      element.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return (
          bounds.left >= 7 &&
          bounds.top >= 7 &&
          bounds.right <= document.documentElement.clientWidth - 7 &&
          bounds.bottom <= document.documentElement.clientHeight - 7
        );
      }),
    )
    .toBe(true);
  // Bounds alone do not catch a flyout clipped by its scrolling parent.
  expect(
    await element.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return node.contains(
        document.elementFromPoint(bounds.left + bounds.width / 2, bounds.bottom - 5),
      );
    }),
  ).toBe(true);
}

for (const edge of ['left', 'right'] as const) {
  test(`menus and flyouts stay visible at the bottom ${edge} and after viewport resize`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/tests/browser/harness.html');
    await page.addStyleTag({
      content: `#host { position: fixed; bottom: 0; ${edge}: 0; width: 300px !important; height: 120px !important; }`,
    });
    await page.getByRole('button', { name: 'B actions', exact: true }).click();
    const dialog = page.locator('dialog.layouts-menu');
    await expectOnScreen(dialog);
    const trigger = page.getByRole('button', { name: 'Tab display', exact: true });
    await trigger.hover();
    const flyout = page.getByRole('menu', { name: 'Tab display', exact: true });
    await expectOnScreen(flyout);
    await flyout.getByRole('menuitemradio', { name: 'Compact', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-node-id="right"]')).toHaveAttribute(
      'data-tab-display',
      'compact',
    );

    await page.getByRole('button', { name: 'B actions', exact: true }).click();
    await page.setViewportSize({ width: 240, height: 180 });
    await expectOnScreen(dialog);
    expect(await dialog.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await trigger.focus();
    await page.keyboard.press('ArrowRight');
    await expectOnScreen(flyout);
    await expect(
      flyout.getByRole('menuitemradio', { name: 'Workspace default', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(flyout).toBeHidden();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 800, height: 600 });
    expect(await page.evaluate(() => window.harness.stats.errors)).toEqual([]);
  });
}

for (const edge of ['left', 'right'] as const) {
  for (const label of ['Tab orientation', 'Tab display'] as const) {
    test(`${label} stays open while crossing the gap into its ${edge === 'left' ? 'right' : 'left'} flyout`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1000, height: 800 });
      await page.goto('/tests/browser/harness.html');
      await page.addStyleTag({
        content: `#host { position: fixed; top: 0; ${edge}: 0; width: 300px !important; height: 120px !important; }`,
      });
      await page.getByRole('button', { name: 'B actions', exact: true }).click();
      const trigger = page.getByRole('button', { name: label, exact: true });
      const flyout = page.getByRole('menu', { name: label, exact: true });
      await trigger.hover();
      const row = (await trigger.boundingBox())!;
      const bounds = (await flyout.boundingBox())!;
      const opensRight = edge === 'left';
      expect(opensRight ? bounds.x >= row.x + row.width : bounds.x + bounds.width <= row.x).toBe(
        true,
      );
      const gapX = opensRight
        ? (row.x + row.width + bounds.x) / 2
        : (bounds.x + bounds.width + row.x) / 2;
      await page.mouse.move(gapX, row.y + row.height / 2, { steps: 10 });
      // Model a real pointer crossing the padding, rather than teleporting to the option.
      await page.waitForTimeout(100);
      await expect(flyout).toBeVisible();
      const option = flyout.getByRole('menuitemradio', {
        name: label === 'Tab orientation' ? 'Vertical' : 'Compact',
        exact: true,
      });
      await option.hover();
      await page.waitForTimeout(400);
      await expect(flyout).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await page.mouse.move(500, 750);
      await expect(flyout).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.hover();
      await option.click();
      await expect(page.locator('dialog.layouts-menu')).toHaveCount(0);
      await expect(page.locator('[data-node-id="right"]')).toHaveAttribute(
        label === 'Tab orientation' ? 'data-tab-placement' : 'data-tab-display',
        label === 'Tab orientation' ? 'left' : 'compact',
      );
    });
  }
}
