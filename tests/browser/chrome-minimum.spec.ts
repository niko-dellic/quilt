import { test, expect } from '@playwright/test';
import type {} from './harness.js';

for (const placement of ['top', 'left'] as const) {
  for (const attachment of ['anchored', 'floating'] as const) {
    for (const display of ['automatic', 'compact'] as const) {
      test(`chrome minimum: ${placement}, ${attachment}, ${display}`, async ({ page }) => {
        await page.goto('/tests/browser/harness.html');
        await page.evaluate(
          ({ placement, attachment, display }) => {
            window.harness.mounted.dispose();
            const host = document.querySelector<HTMLElement>('#host')!;
            host.style.cssText = 'width:20px;height:20px';
            const workspace = new window.harness.Workspace({
              container: host,
              paneTypes: { test: { title: 'Test', render: () => {} } },
              tabBar: { placement, attachment, display },
            });
            // No application-provided minimum sizes.
            for (let i = 0; i < 4; i++) workspace.addPane('test', { id: String(i) });
            Object.assign(window, { minimumWorkspace: workspace });
          },
          { placement, attachment, display },
        );
        const assertFits = async () => {
          await expect
            .poll(() =>
              page.locator('#host .layouts-tabs').evaluate((tabs) => ({
                x: tabs.scrollWidth - tabs.clientWidth,
                y: tabs.scrollHeight - tabs.clientHeight,
              })),
            )
            .toEqual({ x: 0, y: 0 });
          const fit = await page.locator('#host .layouts-group').evaluate((region) => {
            const header = region.querySelector('.layouts-header')!.getBoundingClientRect();
            const rect = region.getBoundingClientRect();
            return header.width <= rect.width + 1 && header.height <= rect.height + 1;
          });
          expect(fit).toBe(true);
        };
        await assertFits();
        await page.evaluate(() => {
          const workspace = (
            window as unknown as { minimumWorkspace: import('quilt-vanilla').WorkspaceHandle }
          ).minimumWorkspace;
          workspace.setTheme({ iconSize: '2rem' });
          workspace.refreshTheme();
        });
        await assertFits();
        const saved = await page.evaluate(() => {
          const workspace = (
            window as unknown as { minimumWorkspace: import('quilt-vanilla').WorkspaceHandle }
          ).minimumWorkspace;
          return workspace.exportLayout();
        });
        expect(Object.values(saved.panes).every((pane) => pane.size === undefined)).toBe(true);
      });
    }
  }
}

test('dividers honor chrome minima, larger application minima, and empty groups without changing JSON', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const workspace = window.harness.mounted;
    workspace.updatePane({
      ...workspace.getLayout().panes.a!,
      size: { minWidth: 0, maxWidth: 10 },
    });
    workspace.updatePane({ ...workspace.getLayout().panes.b!, size: { minWidth: 240 } });
    workspace.resize('split', 0.001);
  });
  const left = page.locator('[data-node-id="left"]');
  const right = page.locator('[data-node-id="right"]');
  await expect.poll(() => left.evaluate((element) => element.clientWidth)).toBeGreaterThan(50);
  await expect
    .poll(() => right.evaluate((element) => element.clientWidth))
    .toBeGreaterThanOrEqual(240);
  await expect
    .poll(() =>
      left
        .locator('.layouts-tabs')
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBe(0);
  // A maximum below chrome freezes the pane at its usable minimum.
  // Remove that maximum before exercising keyboard resizing.
  await page.evaluate(() => {
    const workspace = window.harness.mounted;
    workspace.updatePane({ ...workspace.getLayout().panes.a!, size: {} });
  });
  const divider = page.getByRole('separator').first();
  await divider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(() =>
      left
        .locator('.layouts-tabs')
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    )
    .toBe(0);
  await page.evaluate(() => {
    const workspace = window.harness.mounted;
    workspace.closePane('a', { force: true });
  });
  await expect(left.locator('.layouts-tab-item')).toHaveCount(0);
  expect((await left.boundingBox())!.width).toBeGreaterThan(30);
  const saved = await page.evaluate(() => window.harness.mounted.exportLayout());
  expect(saved.panes.b!.size!.minWidth).toBe(240);
});

test('headerless panes retain small fixed sizes and tab orientation updates recalculate minima', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const workspace = window.harness.mounted;
    workspace.updatePane({
      ...workspace.getLayout().panes.a!,
      header: false,
      size: { minWidth: 10, maxWidth: 10 },
    });
    workspace.resize('split', 0.001);
  });
  const left = page.locator('[data-node-id="left"]');
  await expect.poll(() => left.evaluate((element) => element.clientWidth)).toBe(10);
  await page.evaluate(() => {
    const workspace = window.harness.mounted;
    workspace.updatePane({ ...workspace.getLayout().panes.a!, header: true, size: {} });
    workspace.setTabBar({ placement: 'left' });
  });
  await expect(left).toHaveAttribute('data-tab-placement', 'left');
  await expect
    .poll(() => left.evaluate((element) => element.clientWidth))
    .toBeGreaterThanOrEqual(32);
  await expect
    .poll(() =>
      left
        .locator('.layouts-tabs')
        .evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBe(0);
});
