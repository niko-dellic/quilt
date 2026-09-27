import { expect, test } from '@playwright/test';

for (const demo of ['vanilla', 'react']) {
  test(`${demo}: presets advertise primary keys and alternatives in menus and help`, async ({
    page,
  }) => {
    await page.goto(`/${demo}.html`);
    const scene = page.locator('[data-node-id="scene-group"]');
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    const maximize = page.getByRole('button', { name: 'Maximize region', exact: true });
    await expect(maximize.locator('kbd')).toHaveText('`');
    await expect(maximize).toHaveAttribute('aria-keyshortcuts', '` Alt+Space');
    await expect(maximize).toHaveAttribute('title', 'Maximize region (` / Alt + Space)');
    await expect(
      page.getByRole('button', { name: '+ Add tab', exact: true }).locator('kbd'),
    ).toHaveText('T');
    await expect(
      page.getByRole('button', { name: 'Restore closed tab', exact: true }),
    ).not.toHaveAttribute('aria-keyshortcuts');
    await maximize.click();
    await scene.getByRole('button', { name: 'Scene actions', exact: true }).click();
    const restore = page.getByRole('button', { name: 'Restore region', exact: true });
    await expect(restore.locator('kbd')).toHaveText('`');
    await restore.click();
    await expect(page.getByRole('table', { name: 'Keyboard and mouse shortcuts' })).toContainText(
      '` or Alt + Space',
    );
  });
}

test('live external registrations preserve menu focus, customize hints, and dispatch explicitly', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  const maximize = page.getByRole('button', { name: 'Maximize region', exact: true });
  await maximize.focus();
  const beforeBounds = await page.locator('dialog.layouts-menu').boundingBox();
  const events = await page.evaluate(() => {
    const workspace = window.harness.mounted;
    const events: string[][] = [];
    const off = workspace.on('change', (event) => events.push([...event.changes]));
    workspace.updateOptions({
      shortcuts: {
        maximize: { bindings: [{ key: 'm' }, { key: '+', ctrl: true }], handling: 'external' },
      },
      formatShortcut: (binding) => `Key ${binding.key}`,
    });
    off();
    return events;
  });
  expect(events).toEqual([['shortcuts']]);
  expect(await page.locator('dialog.layouts-menu').boundingBox()).toEqual(beforeBounds);
  await expect(maximize).toBeFocused();
  await expect(maximize.locator('kbd')).toHaveText('Key m');
  await expect(maximize).toHaveAttribute('aria-keyshortcuts', 'm Control+Plus');
  await expect(maximize).toHaveAttribute('title', 'Maximize region (Key m / Key +)');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'A', exact: true }).focus();
  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBeNull();
  expect(await page.evaluate(() => window.harness.mounted.executeAction('maximize'))).toBe(true);
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBe('left');
  expect(await page.evaluate(() => window.harness.stats.mounts)).toBe(2);
});

test('internal collisions execute once, defaults can be restored, and invalid updates are atomic', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      shortcuts: {
        closeActiveTab: { key: 'm' },
        maximize: { key: 'm' },
      },
    }),
  );
  await page.getByRole('tab', { name: 'A', exact: true }).focus();
  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBe('left');
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
  const result = await page.evaluate(() => {
    const workspace = window.harness.mounted;
    let rejected = false;
    try {
      workspace.updateOptions({ shortcuts: { maximize: { key: '' } } });
    } catch {
      rejected = true;
    }
    const key = workspace.getShortcuts()[0]!.bindings[0]!.key;
    workspace.updateOptions({ shortcuts: undefined });
    return { rejected, key, cleared: workspace.getShortcuts() };
  });
  expect(result).toEqual({ rejected: true, key: 'm', cleared: [] });
  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBe('left');
});

test('dispatch checks targets, permissions, close cancellation, and disposal', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(async () => {
    const w = window.harness.mounted;
    const before = JSON.stringify(w.getLayout());
    const missing = await w.executeAction('maximize', { groupId: 'missing' });
    const inconsistent = await w.executeAction('closeActiveTab', { groupId: 'left', paneId: 'b' });
    const stable = before === JSON.stringify(w.getLayout());
    w.updatePane({ ...w.getLayout().panes.a!, capabilities: { close: false } });
    const denied =
      !w.canExecuteAction('closeActiveTab', { paneId: 'a' }) &&
      !(await w.executeAction('closeActiveTab', { paneId: 'a' }));
    w.updatePane({ ...w.getLayout().panes.a!, capabilities: { close: true }, confirmClose: true });
    let prompts = 0;
    w.updateOptions({
      confirmClose: () => {
        prompts++;
        return false;
      },
    });
    const available = w.canExecuteAction('closeActiveTab', { paneId: 'a' });
    const beforePrompt = prompts;
    const cancelled = !(await w.executeAction('closeActiveTab', { paneId: 'a' }));
    w.updateOptions({ confirmClose: () => true });
    const closed = await w.executeAction('closeActiveTab', { paneId: 'a' });
    const restored = await w.executeAction('restoreClosedTab');
    const paneClosed = await w.executeAction('closePane', { groupId: 'right' });
    const restoredAgain = await w.executeAction('restoreClosedTab');
    const count = Object.keys(w.getLayout().panes).length;
    w.dispose();
    return {
      missing,
      inconsistent,
      stable,
      denied,
      available,
      beforePrompt,
      prompts,
      cancelled,
      closed,
      restored,
      paneClosed,
      restoredAgain,
      count,
      disposed: await w.executeAction('maximize', { groupId: 'left' }),
    };
  });
  expect(result).toEqual({
    missing: false,
    inconsistent: false,
    stable: true,
    denied: true,
    available: true,
    beforePrompt: 0,
    prompts: 1,
    cancelled: true,
    closed: true,
    restored: true,
    paneClosed: true,
    restoredAgain: true,
    count: 2,
    disposed: false,
  });
});

test('all tab settings, split directions, join and empty close use shared dispatch', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?no-registry');
  const result = await page.evaluate(async () => {
    const w = window.harness.mounted;
    const settings = [];
    for (const action of [
      'tabOrientationHorizontal',
      'tabOrientationVertical',
      'tabOrientationDefault',
      'tabDisplayAutomatic',
      'tabDisplayCompact',
      'tabDisplayDefault',
    ] as const) {
      settings.push(await w.executeAction(action, { groupId: 'left' }));
    }
    const joined = await w.executeAction('joinSiblingRegion', { groupId: 'left' });
    const contents = Object.keys(w.getLayout().panes).sort();
    const lastEmptyDenied = w.canExecuteAction('closeEmptyPane', { groupId: 'left' });
    await w.executeAction('closePane', { groupId: 'left' });
    const splits = [];
    for (const action of ['splitLeft', 'splitRight', 'splitUp', 'splitDown'] as const) {
      splits.push(await w.executeAction(action, { groupId: 'left' }));
    }
    const emptyClosed = await w.executeAction('closeEmptyPane', { groupId: 'left' });
    return { settings, joined, contents, lastEmptyDenied, splits, emptyClosed };
  });
  expect(result).toEqual({
    settings: Array(6).fill(true),
    joined: true,
    contents: ['a', 'b'],
    lastEmptyDenied: false,
    splits: Array(4).fill(true),
    emptyClosed: true,
  });
});

test('add-tab dispatch opens a picker and popout dispatch preserves user activation and failure rollback', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() =>
    window.harness.tabs.register({
      id: 'test',
      title: 'Test',
      create: () => ({ id: 'c', type: 'test', title: 'C' }),
    }),
  );
  expect(
    await page.evaluate(() => window.harness.mounted.executeAction('addTab', { groupId: 'left' })),
  ).toBe(true);
  await page.getByRole('option', { name: 'Test', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'C', exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ shortcuts: { popout: { key: 'p' } } }),
  );
  await page.getByRole('tab', { name: 'C', exact: true }).focus();
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('p');
  const popup = await popupPromise;
  await expect
    .poll(async () => page.evaluate(() => window.harness.mounted.getLayout().popouts.length))
    .toBe(1);
  await popup.close();
  await expect(page.getByRole('tab', { name: 'C', exact: true })).toBeVisible();
  await page.evaluate(() => window.harness.block());
  expect(
    await page.evaluate(() => window.harness.mounted.executeAction('popout', { paneId: 'c' })),
  ).toBe(false);
  await expect(page.getByRole('tab', { name: 'C', exact: true })).toBeVisible();
});

test('React prop updates and removal refresh open menu hints without remounting panes', async ({
  page,
}) => {
  await page.goto('/tests/browser/react-tab-bar.html');
  await page.getByRole('textbox', { name: 'Retained state' }).fill('keep me');
  await page.getByRole('button', { name: 'Notes actions', exact: true }).click();
  const maximize = page.getByRole('button', { name: 'Maximize region', exact: true });
  await maximize.focus();
  await expect(maximize.locator('kbd')).toHaveText('`');
  const change = page.getByRole('button', { name: 'Change shortcuts' });
  await change.evaluate((button: HTMLButtonElement) => button.click());
  await expect(maximize).toBeFocused();
  await expect(maximize.locator('kbd')).toHaveText('Custom M');
  await expect(maximize).toHaveAttribute('aria-keyshortcuts', 'm');
  await change.evaluate((button: HTMLButtonElement) => button.click());
  await expect(maximize).toBeFocused();
  await expect(maximize.locator('kbd')).toHaveCount(0);
  await expect(maximize).not.toHaveAttribute('aria-keyshortcuts');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Retained state' })).toHaveValue('keep me');
  await page.getByLabel('Mounts').click();
  await expect(page.getByLabel('Mounts')).toHaveText('1');
});

test('shortcut hints cover flyout actions and disabled commands in a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 650 });
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    w.updateOptions({
      shortcuts: {
        closeActiveTab: { key: 'w', ctrl: true },
        tabOrientationVertical: { key: 'v', alt: true },
      },
    });
    w.updatePane({ ...w.getLayout().panes.a!, capabilities: { close: false } });
  });
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  const close = page.getByRole('menuitem', { name: 'Close active tab', exact: true });
  await expect(close).toBeDisabled();
  await expect(close.locator('kbd')).toHaveText('Ctrl + W');
  await expect(close).not.toHaveAttribute('aria-keyshortcuts');
  await page.getByRole('button', { name: 'Tab orientation', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  const vertical = page.getByRole('menuitemradio', { name: 'Vertical', exact: true });
  await expect(vertical.locator('kbd')).toHaveText('Alt + V');
  await expect(vertical).toHaveAttribute('aria-keyshortcuts', 'Alt+v');
  const bounds = (await page
    .getByRole('menu', { name: 'Tab orientation', exact: true })
    .boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(7);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(353);
  await vertical.click();
  await expect(page.locator('[data-node-id="left"]')).toHaveAttribute('data-tab-placement', 'left');
});

test('typing, composition, repeats, handled keys and dialogs do not trigger shortcuts', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  const input = page.getByRole('textbox', { name: 'A', exact: true });
  await input.focus();
  await page.keyboard.press('`');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBeNull();
  await page.getByRole('tab', { name: 'A', exact: true }).focus();
  const state = await page.evaluate(() => {
    for (const init of [{ repeat: true }, { isComposing: true }, {}]) {
      const event = new KeyboardEvent('keydown', {
        key: '`',
        bubbles: true,
        cancelable: true,
        ...init,
      });
      if (!Object.keys(init).length) event.preventDefault();
      document.activeElement!.dispatchEvent(event);
    }
    return window.harness.mounted.getLayout().maximized;
  });
  expect(state).toBeNull();
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await page.keyboard.press('`');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBeNull();
});

test('middle-click registration updates apply without rebuilding the menu anchor', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ shortcuts: { middleClickClose: true } }),
  );
  await page.getByRole('tab', { name: 'A', exact: true }).click({ button: 'middle' });
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.harness.mounted.updateOptions({ shortcuts: false }));
  await page.getByRole('tab', { name: 'B', exact: true }).click({ button: 'middle' });
  await expect(page.getByRole('tab', { name: 'B', exact: true })).toBeVisible();
});
