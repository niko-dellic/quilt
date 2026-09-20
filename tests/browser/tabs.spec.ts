import { test, expect } from '@playwright/test';
for (const framework of ['vanilla', 'react']) {
  test(`${framework}: icon tabs reorder in both directions and close without losing content`, async ({
    page,
  }) => {
    await page.goto(`/${framework}.html`);
    const inspector = page.getByRole('tab', { name: 'Inspector', exact: true });
    const activity = page.getByRole('tab', { name: 'Activity', exact: true });
    await expect(inspector.locator('svg')).toHaveCount(1);
    await inspector.click();
    await page.getByRole('textbox', { name: 'Working notes' }).fill('Retained');
    const group = page.locator('[data-node-id="inspector-group"]');
    const box = await activity.boundingBox();
    await inspector.dragTo(activity, { targetPosition: { x: box!.width / 2 + 2, y: 10 } });
    expect(
      await group
        .getByRole('tab')
        .evaluateAll((tabs) => tabs.map((t) => t.getAttribute('aria-label'))),
    ).toEqual(['Theming', 'Activity', 'Inspector']);
    await inspector.dragTo(activity, { targetPosition: { x: 2, y: 10 } });
    expect(
      await group
        .getByRole('tab')
        .evaluateAll((tabs) => tabs.map((t) => t.getAttribute('aria-label'))),
    ).toEqual(['Theming', 'Inspector', 'Activity']);
    await expect(page.getByRole('textbox', { name: 'Working notes' })).toHaveValue('Retained');
    await activity.click({ button: 'middle' });
    await expect(activity).toHaveCount(0);
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    await expect(inspector).toHaveCount(0);
  });
  for (const shortcut of ['Alt+Space', '`']) {
    test(`${framework}: ${shortcut} toggles the hovered pane and leaves text entry alone`, async ({
      page,
    }) => {
      await page.goto(`/${framework}.html`);
      const scene = page.getByRole('tab', { name: 'Scene', exact: true });
      await scene.hover();
      await page.keyboard.press(shortcut);
      await expect(page.getByRole('tab', { name: 'Inspector', exact: true })).not.toBeVisible();
      await page.keyboard.press(shortcut);
      await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Working notes' });
      await input.click();
      await page.keyboard.press(shortcut);
      await expect(scene).toBeVisible();
      await expect(input).toBeVisible();
    });
  }
}
test('compact tabs retain icons, active close, labels for accessibility, and mounted views', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.evaluate(() => window.harness.store.movePane('b', 'left'));
  const host = page.locator('#host');
  await host.evaluate((el) => {
    el.style.width = '210px';
  });
  const a = page.getByRole('tab', { name: 'A', exact: true });
  const b = page.getByRole('tab', { name: 'B', exact: true });
  await expect(a.locator('.layouts-tab-icon')).toBeVisible();
  await expect(a.locator('.layouts-tab-label')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Close A', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Close B', exact: true })).toBeVisible();
  await a.click();
  await expect(page.getByRole('button', { name: 'Close A', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close B', exact: true })).toBeHidden();
  await host.evaluate((el) => {
    el.style.width = '900px';
  });
  await expect(b.locator('.layouts-tab-label')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close B', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.harness.stats)).toMatchObject({
    mounts: 2,
    disposals: 0,
    live: 2,
  });
});
test('shortcuts are disabled by default and close capability is respected', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  const a = page.getByRole('tab', { name: 'A', exact: true });
  await a.hover();
  for (const shortcut of ['Alt+Space', '`']) {
    await page.keyboard.press(shortcut);
    expect(await page.evaluate(() => window.harness.store.getLayout().maximized)).toBeNull();
  }
  await a.click({ button: 'middle' });
  await expect(a).toBeVisible();
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.evaluate(() =>
    window.harness.store.updatePane({
      ...window.harness.store.getLayout().panes.a!,
      capabilities: { close: false },
    }),
  );
  await expect(page.getByRole('button', { name: 'Close A', exact: true })).toHaveCount(0);
  await a.click({ button: 'middle' });
  await expect(a).toBeVisible();
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Move / })).toHaveCount(0);
});
