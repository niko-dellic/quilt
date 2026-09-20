import { test, expect } from '@playwright/test';
import type {} from './integration.js';
import type {} from './harness.js';
test('React providers, inline options and local state survive parent rerenders', async ({
  page,
}) => {
  await page.goto('/tests/browser/integration.html');
  const input = page.getByRole('textbox', { name: 'Local text' });
  await input.fill('retained');
  const mounts = await page.evaluate(() => window.integration.stats.mounts);
  await page.getByRole('button', { name: 'Rerender' }).click();
  await expect(page.getByLabel('Provider')).toHaveText('context 1');
  await expect(input).toHaveValue('retained');
  expect(await page.evaluate(() => window.integration.stats.mounts)).toBe(mounts);
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByText('Replacement', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.integration.stats.live)).toBe(0);
});
test('React popouts inherit live providers and survive parent updates', async ({ page }) => {
  await page.goto('/tests/browser/integration.html');
  await expect(page.getByLabel('Provider')).toHaveText('context 0');
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out' }).click();
  const popup = await opened;
  await expect(popup.getByLabel('Provider')).toHaveText('context 0');
  await popup.getByRole('textbox').fill('companion');
  await page.getByRole('button', { name: 'Rerender' }).click();
  await expect(popup.getByLabel('Provider')).toHaveText('context 1');
  await expect(popup.getByRole('textbox')).toHaveValue('companion');
  expect(popup.isClosed()).toBe(false);
  await page.evaluate(() => window.integration.dispose());
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(await page.evaluate(() => window.integration.stats.live)).toBe(0);
});
test('React destination errors preserve the source view', async ({ page }) => {
  await page.goto('/tests/browser/integration.html');
  await page.getByRole('textbox').fill('source survives');
  await page.evaluate(() => window.integration.fail());
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out' }).click();
  const popup = await opened;
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByRole('textbox')).toHaveValue('source survives');
  expect(await page.evaluate(() => window.integration.store.getLayout().popouts.length)).toBe(0);
});
test('workspace exports dock copies and invalid imports leave live settings untouched', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out' }).click();
  const popup = await opened;
  const result = await page.evaluate(() => {
    const { mounted, store } = window.harness;
    mounted.setTheme({ panel: '#123456' });
    mounted.setTabBar({ placement: 'left' });
    store.setAutoCollapse('protected');
    const preset = mounted.exportWorkspace();
    try {
      mounted.loadWorkspace({ ...preset, tabBar: { placement: 'invalid' } });
    } catch {
      /* expected */
    }
    return {
      preset,
      current: mounted.exportWorkspace(),
      detached: store.getLayout().popouts.length,
    };
  });
  expect(result.preset).toEqual(result.current);
  expect(result.preset.layout.popouts).toEqual([]);
  expect(Object.keys(result.preset.layout.panes)).toEqual(['a', 'b']);
  expect(result.detached).toBe(1);
  expect(popup.isClosed()).toBe(false);
  await page.evaluate(() => {
    const { mounted } = window.harness;
    mounted.loadWorkspace(JSON.parse(JSON.stringify(mounted.exportWorkspace())));
  });
  await expect.poll(() => popup.isClosed()).toBe(true);
  await expect(page.getByRole('textbox', { name: 'A', exact: true })).toBeVisible();
});
test('optional group confirmation cancels, commits once, and rejects stale requests', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const { store } = window.harness;
    store.movePane('b', 'left');
    store.updatePane({ ...store.getLayout().panes.a!, confirmClose: true });
    void window.harness.mounted.closeGroup('left');
  });
  await expect(page.getByRole('dialog', { name: 'Close selected panes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(
    await page.evaluate(() => Object.keys(window.harness.store.getLayout().panes)),
  ).toHaveLength(2);
  await page.evaluate(() => {
    void window.harness.mounted.closeGroup('left');
  });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(
    await page.evaluate(() => Object.keys(window.harness.store.getLayout().panes)),
  ).toHaveLength(0);
  await page.evaluate(() => {
    const { store, mounted } = window.harness;
    store.restoreClosedPane();
    store.restoreClosedPane();
    mounted.updateOptions({
      confirmClose: () => new Promise((resolve) => setTimeout(() => resolve(true), 50)),
    });
    void mounted.closeGroup('left');
    store.updatePane({ ...store.getLayout().panes.a!, title: 'Changed' });
  });
  await expect(page.getByRole('tab', { name: 'Changed', exact: true })).toBeVisible();
});
test('relative theme lengths refresh geometry without imposing content resets', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px';
    window.harness.mounted.setTheme({ resizeHandleWidth: 'calc(0.5rem + 2px)' });
  });
  await expect(page.getByRole('separator')).toHaveCSS('width', '12px');
  await page.evaluate(() => {
    const style = document.createElement('style');
    document.head.append(style);
    window.harness.mounted.setTheme({});
    style.sheet!.insertRule('#host { --layouts-resize-handle-width: 18px; }');
    window.harness.mounted.refreshTheme();
  });
  await expect(page.getByRole('separator')).toHaveCSS('width', '18px');
  expect(
    await page
      .getByRole('textbox', { name: 'A', exact: true })
      .evaluate((el) => el.hasAttribute('data-layouts-chrome')),
  ).toBe(false);
});
test('shortcut ownership follows focus across two workspaces and accepts custom bindings', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.evaluate(() => {
    window.harness.secondary();
    window.harness.store.closePane('b', { force: true });
    window.harness.extra.store.closePane('b', { force: true });
    window.harness.mounted.updateOptions({
      shortcuts: { restoreClosedTab: { key: 'z', ctrl: true } },
    });
  });
  await page.locator('#secondary').getByRole('tab', { name: 'A', exact: true }).focus();
  await page.keyboard.press('r');
  expect(await page.evaluate(() => !!window.harness.store.getLayout().panes.b)).toBe(false);
  expect(await page.evaluate(() => !!window.harness.extra.store.getLayout().panes.b)).toBe(true);
  await page.locator('#host').getByRole('tab', { name: 'A', exact: true }).focus();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => !!window.harness.store.getLayout().panes.b)).toBe(true);
});
test('unified registration replaces unknown content and supplies optional confirmation', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => window.harness.useRegistry());
  await expect(page.getByText('Unknown pane type: test.', { exact: false })).toHaveCount(2);
  await page.evaluate(() => {
    window.harness.registerTest();
  });
  await expect(page.getByText('Dynamic renderer', { exact: true })).toHaveCount(2);
  await page.evaluate(() => {
    window.harness.mounted.updateOptions({
      messages: { 'Close selected panes?': 'Fermer les panneaux ?', Cancel: 'Annuler' },
      popouts: false,
    });
    void window.harness.mounted.closePane('a');
  });
  await expect(page.getByRole('dialog', { name: 'Fermer les panneaux ?' })).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open in window' })).toHaveCount(0);
});
test('a failed renderer can be retried without remounting unrelated panes', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    let attempts = 0;
    window.harness.mounted.updateOptions({
      renderers: {
        test: ({ element, pane }) => {
          if (pane.id === 'a' && attempts++ === 0) throw new Error('Initial failure');
          element.textContent = 'Recovered ' + pane.id;
          return { dispose() {} };
        },
      },
    });
  });
  await expect(page.getByText('Could not mount A.', { exact: false })).toBeVisible();
  await page.evaluate(() => window.harness.mounted.retryPane('a'));
  await expect(page.getByText('Recovered a', { exact: true })).toBeVisible();
  await expect(page.getByText('Recovered b', { exact: true })).toBeVisible();
});
test('disposal cancels pending confirmation and prevents late application approval', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const remaining = await page.evaluate(async () => {
    const { mounted, store } = window.harness;
    store.updatePane({ ...store.getLayout().panes.a!, confirmClose: true });
    let approve!: (value: boolean) => void;
    mounted.updateOptions({
      confirmClose: () =>
        new Promise((resolve) => {
          approve = resolve;
        }),
    });
    const snapshot = store.getLayout();
    let changes = 0;
    mounted.on('change', () => changes++);
    const closed = mounted.closePane('a');
    mounted.dispose();
    approve(true);
    return { closed: await closed, exists: !!snapshot.panes.a, changes };
  });
  expect(remaining).toEqual({ closed: false, exists: true, changes: 0 });
});
test('pending popouts cancel when disabled and retain source content', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.mounted.updateOptions({
      renderers: {
        test: ({ element, location }) => {
          element.textContent = 'Source available';
          return {
            dispose() {},
            ...(location === 'popout' ? { ready: new Promise<void>(() => {}) } : {}),
          };
        },
      },
    });
  });
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await expect(page.getByText('Source available', { exact: true })).toHaveCount(2);
  await page.evaluate(() => window.harness.mounted.updateOptions({ popouts: false }));
  await expect.poll(() => popup.isClosed()).toBe(true);
  expect(await page.evaluate(() => window.harness.store.getLayout().popouts)).toEqual([]);
});
test('confirmation callback rejection cancels and unflagged panes do not prompt', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(async () => {
    const { mounted, store, stats } = window.harness;
    let calls = 0;
    mounted.updateOptions({
      confirmClose: () => {
        calls++;
        return Promise.reject(new Error('Dialog failed'));
      },
    });
    store.updatePane({ ...store.getLayout().panes.a!, confirmClose: true });
    const rejected = await mounted.closePane('a');
    const unflagged = await mounted.closePane('b');
    return {
      rejected,
      unflagged,
      calls,
      exists: !!store.getLayout().panes.a,
      errors: stats.errors,
    };
  });
  expect(result).toMatchObject({ rejected: false, unflagged: true, calls: 1, exists: true });
  expect(result.errors.join(' ')).toContain('Dialog failed');
});
test('callback-only updates keep an open menu and preserve its active interaction', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'A actions' });
  await expect(menu).toBeVisible();
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      onError: () => {},
      getPaneState: () => ({ current: true }),
    }),
  );
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Close active tab', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'A', exact: true })).toHaveCount(0);
});
test('clearing unified registration removes derived views and restores option defaults', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    window.harness.useRegistry();
    window.harness.registerTest();
  });
  await expect(page.getByText('Dynamic renderer').first()).toBeVisible();
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      theme: { panel: '#123456' },
      tabBar: { placement: 'left' },
      messages: { 'Pane workspace': 'Custom workspace' },
      popouts: false,
    }),
  );
  await expect(page.getByLabel('Custom workspace', { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.harness.mounted.updateOptions({
      registry: undefined,
      theme: undefined,
      tabBar: undefined,
      messages: undefined,
      popouts: undefined,
    }),
  );
  await expect(page.getByLabel('Pane workspace', { exact: true })).toBeVisible();
  await expect(page.getByText('Unknown pane type:', { exact: false }).first()).toBeVisible();
  const preset = await page.evaluate(() => window.harness.mounted.exportWorkspace());
  expect(preset.theme).toEqual({});
  expect(preset.tabBar).toEqual({});
});
