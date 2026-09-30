import { expect, test } from '@playwright/test';
import type {} from './harness.js';

test('live defaults and overrides control tabs, region actions, and resizing', async ({ page }) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  const tab = page.getByRole('tab', { name: 'A', exact: true });
  await expect(tab).toHaveAttribute('draggable', 'true');
  const result = await page.evaluate(async () => {
    const w = window.harness.mounted;
    const before = JSON.stringify(w.exportWorkspace());
    w.updateOptions({ capabilities: { defaults: { resize: false, move: false, close: false } } });
    return {
      closed: await w.executeAction('closeActiveTab', { paneId: 'a' }),
      regionClose: w.canExecuteAction('closePane', { groupId: 'left' }),
      unchanged: before === JSON.stringify(w.exportWorkspace()),
    };
  });
  expect(result).toEqual({ closed: false, regionClose: false, unchanged: true });
  await expect(tab).toHaveAttribute('draggable', 'false');
  await expect(page.getByRole('button', { name: 'Close A', exact: true })).toHaveCount(0);
  await expect(page.getByRole('separator', { includeHidden: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      capabilities: {
        defaults: { close: false, move: false },
        groups: { left: { move: true } },
        panes: { a: { close: true } },
      },
    }),
  );
  await expect(tab).toHaveAttribute('draggable', 'true');
  await expect(page.getByRole('button', { name: 'Close A', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close B', exact: true })).toHaveCount(0);
  await expect(page.getByRole('separator')).toHaveAttribute('aria-disabled', 'false');
  await page.evaluate(() => window.harness.mounted.updateOptions({ capabilities: undefined }));
  await expect(page.getByRole('button', { name: 'Close B', exact: true })).toBeVisible();
});

test('capability changes during confirmation prevent closing', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  const closed = await page.evaluate(async () => {
    const w = window.harness.mounted;
    w.updatePane({ ...w.getLayout().panes.a!, confirmClose: true });
    w.updateOptions({
      confirmClose: () => {
        w.updateOptions({ capabilities: { defaults: { close: false } } });
        return true;
      },
    });
    return w.executeAction('closeActiveTab', { paneId: 'a' });
  });
  expect(closed).toBe(false);
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
});

test('React applies and removes capability props without remounting content', async ({ page }) => {
  await page.goto('/tests/browser/react-tab-bar.html');
  const input = page.getByRole('textbox', { name: 'Retained state' });
  await input.fill('preserved');
  await page.getByRole('button', { name: 'Toggle interaction lock' }).click();
  await expect(page.getByRole('tab')).toHaveAttribute('draggable', 'false');
  await expect(page.getByRole('button', { name: 'Close Notes', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle interaction lock' }).click();
  await expect(page.getByRole('tab')).toHaveAttribute('draggable', 'true');
  await expect(page.getByRole('button', { name: 'Close Notes', exact: true })).toBeVisible();
  await expect(input).toHaveValue('preserved');
});

test('reorder-only tabs can move within their region but cannot leave it', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    w.insertPane({ id: 'c', type: 'test', title: 'C' }, 'left');
    w.updateOptions({ capabilities: { defaults: { move: false, reorder: true } } });
  });
  const a = page.getByRole('tab', { name: 'A', exact: true });
  const c = page.getByRole('tab', { name: 'C', exact: true });
  const b = page.getByRole('tab', { name: 'B', exact: true });
  const box = await c.boundingBox();
  await a.dragTo(c, { targetPosition: { x: box!.width - 4, y: 10 } });
  const left = page.locator('[data-node-id="left"]');
  await expect(left.getByRole('tab')).toHaveText([/C/, /A/]);
  await a.dragTo(b);
  await expect(left.getByRole('tab')).toHaveText([/C/, /A/]);
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      capabilities: { defaults: { move: true, reorder: false } },
    }),
  );
  await a.dragTo(c, { targetPosition: { x: 2, y: 10 } });
  await expect(left.getByRole('tab')).toHaveText([/C/, /A/]);
  await a.dragTo(b);
  await expect(left.getByRole('tab')).toHaveCount(1);
  await expect(page.locator('[data-node-id="right"]').getByRole('tab')).toHaveCount(2);
});

test('creation and maximization permissions control menus and shortcuts independently', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      capabilities: { defaults: { addTab: false, maximize: false } },
    }),
  );
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Add tab', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Maximize region', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'A', exact: true }).hover();
  await page.keyboard.press('`');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBeNull();
  await page.evaluate(() => {
    const w = window.harness.mounted;
    window.harness.tabs.register({
      id: 'new',
      title: 'New',
      create: () => ({ id: 'new', type: 'test', title: 'New' }),
    });
    w.updateOptions({ capabilities: { defaults: { move: false, addTab: true, maximize: true } } });
    return w.executeAction('maximize', { groupId: 'left' });
  });
  expect(
    await page.evaluate(() =>
      window.harness.mounted.canExecuteAction('addTab', { groupId: 'left' }),
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ capabilities: { defaults: { maximize: false } } }),
  );
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await page.getByRole('button', { name: 'Restore region', exact: true }).click();
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBeNull();
});

test('popout scopes respect the global switch and returning remains possible', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  expect(
    await page.evaluate(async () => {
      const w = window.harness.mounted;
      w.updateOptions({ capabilities: { defaults: { popout: false } } });
      return w.popout('a');
    }),
  ).toBe(false);
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      popouts: false,
      capabilities: { defaults: { popout: false }, panes: { a: { popout: true } } },
    }),
  );
  expect(
    await page.evaluate(() => window.harness.mounted.canExecuteAction('popout', { paneId: 'a' })),
  ).toBe(false);
  await page.evaluate(() => window.harness.mounted.updateOptions({ popouts: true }));
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('button', { name: 'Return to layout' })).toBeVisible();
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ capabilities: { defaults: { popout: false } } }),
  );
  await popup
    .getByRole('button', { name: 'Return to layout' })
    .click()
    .catch((error) => {
      if (!popup.isClosed()) throw error;
    });
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
});

test('disabling popouts cancels an opening waiting for its view to become ready', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      renderers: {
        test: ({ element, location }) => {
          element.textContent = location === 'main' ? 'Original view' : 'Pending view';
          return location === 'popout'
            ? { ready: new Promise<void>(() => {}), dispose() {} }
            : { dispose() {} };
        },
      },
    }),
  );
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await expect(popup.getByText('Pending view')).toBeVisible();
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({ capabilities: { groups: { left: { popout: false } } } }),
  );
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.harness.mounted.getLayout().popouts)).toEqual([]);
});
