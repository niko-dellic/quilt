import { test, expect } from '@playwright/test';
import type {} from './harness.js';
test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await expect(page.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
});
test('resize, move and maximize preserve pane instances', async ({ page }) => {
  await page.evaluate(() => {
    for (let i = 0; i < 30; i++) {
      window.harness.store.resize('split', 0.3 + i * 0.01);
    }
    window.harness.store.movePane('b', 'left');
    window.harness.store.maximize('left');
    window.harness.store.maximize(null);
  });
  const stats = await page.evaluate(() => window.harness.stats);
  expect(stats.mounts).toBe(2);
  expect(stats.disposals).toBe(0);
  expect(stats.live).toBe(2);
  expect(stats.errors).toEqual([]);
});
test('blocked popup retains the original view and layout', async ({ page }) => {
  await page.evaluate(() => window.harness.block());
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
  const result = await page.evaluate(() => ({
    stats: window.harness.stats,
    popouts: window.harness.store.exportLayout().popouts,
  }));
  expect(result.popouts).toEqual([]);
  expect(result.stats.mounts).toBe(2);
  expect(result.stats.errors[0]).toContain('blocked');
});
test('failed destination mount rolls back without disposing the source', async ({ page }) => {
  await page.evaluate(() => window.harness.fail());
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
  const stats = await page.evaluate(() => window.harness.stats);
  expect(stats.live).toBe(2);
  expect(stats.disposals).toBe(0);
  expect(stats.errors[0]).toContain('Deliberate destination failure');
});
test('repeated popouts release each view and companion', async ({ page, context }) => {
  for (let i = 0; i < 4; i++) {
    const opened = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Pop out', exact: true }).click();
    const popup = await opened;
    await popup.getByRole('textbox', { name: 'A', exact: true }).fill('cycle ' + i);
    await popup
      .getByRole('button', { name: 'Return to layout', exact: true })
      .click()
      .catch((error) => {
        if (!popup.isClosed()) throw error;
      });
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect(page.getByRole('textbox', { name: 'A', exact: true })).toHaveValue('cycle ' + i);
  }
  const stats = await page.evaluate(() => window.harness.stats);
  expect(stats.live).toBe(2);
  expect(stats.mounts - stats.disposals).toBe(2);
  expect(context.pages()).toHaveLength(1);
  await page.evaluate(() => {
    window.harness.dispose();
    window.harness.dispose();
  });
  expect(await page.evaluate(() => window.harness.stats.live)).toBe(0);
});
test('restoring JSON containing a popout never opens a window automatically', async ({
  page,
  context,
}) => {
  await page.evaluate(() => {
    const layout = structuredClone(window.harness.fixture);
    layout.root = { kind: 'group', id: 'right', panes: ['b'], active: 'b' };
    layout.popouts = [
      { paneId: 'a', groupId: 'left', index: 0, placement: { width: 420, height: 320 } },
    ];
    window.harness.store.loadLayout(layout);
  });
  expect(context.pages()).toHaveLength(1);
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open in window', exact: true })).toBeVisible();
});
test('disposing the main session closes its companion and releases views', async ({ page }) => {
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await expect(popup.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
  await page.evaluate(() => window.harness.dispose());
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(await page.evaluate(() => window.harness.stats.live)).toBe(0);
});
test('pointer resizing respects minimum pane dimensions', async ({ page }) => {
  const divider = page.getByRole('separator');
  const box = await divider.boundingBox();
  await page.mouse.move(box!.x + 2, box!.y + 60);
  await page.mouse.down();
  await page.mouse.move(5, box!.y + 60);
  await page.mouse.up();
  expect((await page.locator('[data-node-id="left"]').boundingBox())!.width).toBe(100);
});
test('loading a different node kind with the same id rebuilds chrome and retains panes', async ({
  page,
}) => {
  await page.evaluate(() => {
    const d = window.harness.store.exportLayout();
    d.root = { kind: 'group', id: 'split', panes: ['a', 'b'], active: 'a' };
    window.harness.store.loadLayout(d);
  });
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'B', exact: true })).toBeVisible();
  expect((await page.evaluate(() => window.harness.stats)).errors).toEqual([]);
});
test('unknown types remain visible and do not execute layout params', async ({ page }) => {
  await page.evaluate(() => {
    window.harness.store.updatePane({
      id: 'a',
      title: 'Unavailable',
      type: 'missing',
      params: { html: '<img src=x onerror=alert(1)>' },
    });
  });
  await expect(page.getByText('Unknown pane type: missing.', { exact: false })).toBeVisible();
  await expect(page.locator('img')).toHaveCount(0);
});
test('pane metadata and params update in a live companion', async ({ page }) => {
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await page.evaluate(() =>
    window.harness.store.updatePane({
      id: 'a',
      title: 'Renamed',
      type: 'test',
      params: { revision: 2 },
    }),
  );
  await expect(popup.getByRole('textbox', { name: 'Renamed', exact: true })).toBeVisible();
  await expect(popup).toHaveTitle('Renamed — layouts');
  expect(await page.evaluate(() => window.harness.stats.live)).toBe(2);
  await popup.close();
  await expect(page.getByRole('textbox', { name: 'Renamed', exact: true })).toBeVisible();
});
