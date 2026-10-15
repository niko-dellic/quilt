import { expect, test } from '@playwright/test';

for (const placement of ['top', 'left'] as const) {
  test(`global context menu modes work live on ${placement} bars without remounting content`, async ({
    page,
  }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate((placement) => window.harness.setTabBar({ placement }), placement);
    const before = await page.evaluate(() => ({
      mounts: window.harness.stats.mounts,
      layout: window.harness.store.exportLayout(),
    }));
    const buttons = page.locator('.layouts-header > button[aria-haspopup="dialog"]');
    const bar = page.locator('[data-node-id="right"] > .layouts-header');
    const dialog = page.locator('dialog.layouts-menu');
    await expect(buttons).toHaveCount(2);
    await bar.click({ button: 'right' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    for (const mode of ['right-click', 'both', 'none', 'button'] as const) {
      await page.evaluate(
        (contextMenu) => window.harness.mounted.updateOptions({ contextMenu }),
        mode,
      );
      await expect(buttons).toHaveCount(mode === 'button' || mode === 'both' ? 2 : 0);
      const prevented = await bar.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return !node.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + 5,
            clientY: rect.top + 5,
          }),
        );
      });
      expect(prevented).toBe(mode === 'right-click' || mode === 'both');
      if (prevented) {
        await expect(dialog).toHaveAttribute('aria-label', 'B actions');
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      } else {
        await expect(dialog).toHaveCount(0);
      }
      if (mode === 'both' || mode === 'button') {
        await page.getByRole('button', { name: 'B actions', exact: true }).click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
    expect(
      await page.evaluate(() => ({
        mounts: window.harness.stats.mounts,
        layout: window.harness.store.exportLayout(),
      })),
    ).toEqual(before);
    await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'both' }));
    expect(
      await page
        .locator('[role="tabpanel"]')
        .first()
        .evaluate(
          (node) =>
            !node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
        ),
    ).toBe(false);
    await expect(dialog).toHaveCount(0);
    await page.getByRole('tab', { name: 'B', exact: true }).click({ button: 'right' });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'none' }));
    await expect(dialog).toHaveCount(0);
    await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: undefined }));
    await expect(buttons).toHaveCount(2);
    await bar.click({ button: 'right' });
    await expect(dialog).toBeVisible();
  });
}

test('empty regions expose the same right-click menu and respect none', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.store.closePane('a', { force: true });
    window.harness.mounted.updateOptions({ contextMenu: 'right-click' });
  });
  const bar = page.locator('[data-node-id="left"] > .layouts-header');
  await expect(bar.getByRole('button', { name: 'Empty pane actions', exact: true })).toHaveCount(0);
  await bar.click({ button: 'right' });
  const dialog = page.getByRole('dialog', { name: 'Empty pane actions', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close empty pane', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenu: 'none' }));
  await bar.dispatchEvent('contextmenu');
  await expect(dialog).toHaveCount(0);
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: workspace setting offers all menu modes`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const setting = page
      .getByRole('region', { name: 'Tab', exact: true })
      .getByLabel('Pane context menu', { exact: true });
    const buttons = page.locator('.layouts-header > button[aria-haspopup="dialog"]');
    await expect(setting).toHaveValue('both');
    await expect(setting.locator('option:checked')).toHaveText('Integrated and right-click');
    for (const mode of ['right-click', 'both', 'none', 'button']) {
      await setting.selectOption(mode);
      if (mode === 'right-click' || mode === 'none') await expect(buttons).toHaveCount(0);
      else
        await expect(
          page.getByRole('button', { name: 'Settings actions', exact: true }),
        ).toBeVisible();
    }
  });
}

test('right-clicking a modal menu or backdrop leaves its position unchanged', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.getByRole('tab', { name: 'B', exact: true }).click({ button: 'right' });
  const dialog = page.getByRole('dialog', { name: 'B actions', exact: true });
  const before = await dialog.boundingBox();
  expect(
    await dialog.evaluate((node) =>
      node.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 50,
          clientY: 80,
        }),
      ),
    ),
  ).toBe(true);
  expect(await dialog.boundingBox()).toEqual(before);
});

test('integrated icon updates globally, including empty regions, without remounting panes', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => window.harness.store.closePane('a', { force: true }));
  const buttons = page.locator('.layouts-header > button[aria-haspopup="dialog"]');
  const circles = buttons.locator('svg circle');
  const before = await page.evaluate(() => ({
    mounts: window.harness.stats.mounts,
    layout: window.harness.store.exportLayout(),
  }));
  await expect(buttons).toHaveCount(2);
  await expect(circles).toHaveCount(6);
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenuIcon: 'one-dot' }));
  await expect(circles).toHaveCount(2);
  await page.getByRole('button', { name: 'Empty pane actions', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Empty pane actions', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'B actions', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'B actions', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.harness.mounted.updateOptions({ contextMenuIcon: undefined }));
  await expect(circles).toHaveCount(6);
  expect(
    await page.evaluate(() => ({
      mounts: window.harness.stats.mounts,
      layout: window.harness.store.exportLayout(),
    })),
  ).toEqual(before);
});

for (const framework of ['vanilla', 'react']) {
  test(`${framework}: Tab settings select integrated button appearance`, async ({ page }) => {
    await page.goto(`/${framework}.html`);
    const setting = page
      .getByRole('region', { name: 'Tab', exact: true })
      .getByLabel('Integrated button appearance', { exact: true });
    const button = page.getByRole('button', { name: 'Settings actions', exact: true });
    await expect(setting).toHaveValue('three-dots');
    await expect(button.locator('circle')).toHaveCount(3);
    await setting.selectOption('one-dot');
    await expect(button.locator('circle')).toHaveCount(1);
    await setting.selectOption('three-dots');
    await expect(button.locator('circle')).toHaveCount(3);
  });
}

for (const mode of [undefined, 'both', 'right-click', 'button', 'none'] as const) {
  test(`picker content and backdrop do not open a pane menu in ${mode} mode`, async ({ page }) => {
    await page.goto('/tests/browser/harness.html');
    await page.evaluate(async (contextMenu) => {
      const h = window.harness;
      h.tabs.register({
        id: 'new',
        title: 'New',
        create: () => ({ id: 'new', type: 'test', title: 'New' }),
      });
      h.mounted.updateOptions({ contextMenu });
      await h.mounted.executeAction('addTab', { groupId: 'right' });
    }, mode);
    const picker = page.locator('dialog.layouts-picker');
    for (const target of [picker, picker.getByRole('combobox')]) {
      expect(
        await target.evaluate((node) =>
          node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
        ),
      ).toBe(true);
      await expect(picker).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'B actions', exact: true })).toHaveCount(0);
    }
  });
}

test('pane content owns right-click events before and after Quilt menus close', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  for (const pinned of [false, true]) {
    if (pinned) await page.evaluate(() => window.harness.mounted.dedicateGroup('left'));
    await page.locator('[data-node-id="left"] [data-corner="tl"]').click({ button: 'right' });
    await expect(page.getByRole('dialog', { name: 'A actions', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    const result = await page.getByRole('tabpanel', { name: 'A', exact: true }).evaluate((node) => {
      let called = false;
      node.addEventListener(
        'contextmenu',
        () => {
          called = true;
        },
        { once: true },
      );
      const unhandled = node.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
      );
      return { called, unhandled };
    });
    expect(result).toEqual({ called: true, unhandled: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('corner handles open their region menu for ordinary, pinned, and empty panes', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const region = page.locator('[data-node-id="left"]');
  for (const state of ['ordinary', 'pinned', 'empty']) {
    if (state === 'pinned') await page.evaluate(() => window.harness.mounted.dedicateGroup('left'));
    if (state === 'empty')
      await page.evaluate(() => window.harness.mounted.closePane('a', { force: true }));
    const before = await page.evaluate(() => window.harness.mounted.exportLayout());
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      await region.locator(`[data-corner="${corner}"]`).click({ button: 'right' });
      await expect(
        page.getByRole('dialog', {
          name: state === 'empty' ? 'Empty pane actions' : 'A actions',
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator('.layouts-corner-preview')).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
    expect(await page.evaluate(() => window.harness.mounted.exportLayout())).toEqual(before);
  }
  for (const mode of ['right-click', 'button', 'none', 'both'] as const) {
    await page.evaluate(
      (contextMenu) => window.harness.mounted.updateOptions({ contextMenu }),
      mode,
    );
    const prevented = await region
      .locator('[data-corner="tl"]')
      .evaluate(
        (node) =>
          !node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      );
    expect(prevented).toBe(mode === 'right-click' || mode === 'both');
    if (prevented) await page.keyboard.press('Escape');
  }
});
