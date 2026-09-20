import { test, expect } from '@playwright/test';
import type {} from './harness.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
});

test('pane types create handles with stable IDs, defaults, factory cancellation and atomic validation', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const { Workspace } = window.harness;
    const host = document.createElement('div');
    const workspace = new Workspace({
      container: host,
      paneTypes: {
        note: {
          title: 'Note',
          render: ({ element }) => {
            element.textContent = 'note';
          },
        },
        cancelled: { title: 'Cancelled', render: () => {}, create: () => undefined },
        explicit: {
          title: 'Explicit',
          render: () => {},
          create: () => ({ id: 'factory-id', title: 'Factory' }),
        },
      },
    });
    const generated = workspace.addPane('note')!;
    const named = workspace.addPane('note', { id: 'named', title: 'Mine' })!;
    named.setTitle('Renamed');
    const explicit = workspace.addPane('explicit')!;
    const events: string[] = [];
    workspace.on('change', (e) => events.push(e.action));
    const before = workspace.exportWorkspace();
    let rejected = 0;
    for (const fn of [
      () => workspace.addPane('missing'),
      () => workspace.addPane('note', { id: 'named' }),
      () => workspace.addPane('note', { groupId: 'missing' }),
    ]) {
      try {
        fn();
      } catch {
        rejected++;
      }
    }
    const cancelled = workspace.addPane('cancelled');
    const result = {
      generated: !!generated.id,
      title: named.getSnapshot().title,
      explicit: explicit.id,
      lookup: workspace.getPane('named') === named,
      count: workspace.getPanes().length,
      unchanged: JSON.stringify(before) === JSON.stringify(workspace.exportWorkspace()),
      rejected,
      cancelled: cancelled === undefined,
      events,
    };
    workspace.dispose();
    return result;
  });
  expect(result).toEqual({
    generated: true,
    title: 'Renamed',
    explicit: 'factory-id',
    lookup: true,
    count: 3,
    unchanged: true,
    rejected: 3,
    cancelled: true,
    events: [],
  });
});

test('handles survive movement and metadata updates, but not removal or successful restoration', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const workspace = new window.harness.Workspace({
      container: document.createElement('div'),
      initialLayout: window.harness.fixture,
    });
    const a = workspace.getPane('a')!;
    a.move('right');
    a.activate();
    a.update({ title: 'Updated' });
    const stable = a === workspace.getPane('a') && !a.isDisposed;
    try {
      workspace.loadWorkspace({ version: 99 });
    } catch {
      /* Invalid load preserves handles. */
    }
    const preserved = !a.isDisposed;
    await a.close();
    const closed = a.isDisposed;
    let failures = 0;
    try {
      a.setTitle('stale');
    } catch {
      failures++;
    }
    try {
      await a.popout();
    } catch {
      failures++;
    }
    workspace.restoreClosedPane();
    const restored = workspace.getPane('a')!;
    const different = restored !== a;
    workspace.loadWorkspace(workspace.exportWorkspace());
    const replaced = restored.isDisposed;
    const current = workspace.getPane('a')!;
    workspace.dispose();
    workspace.dispose();
    return {
      stable,
      preserved,
      closed,
      failures,
      different,
      replaced,
      disposed: current.isDisposed,
      private: !('store' in workspace),
    };
  });
  expect(result).toEqual({
    stable: true,
    preserved: true,
    closed: true,
    failures: 2,
    different: true,
    replaced: true,
    disposed: true,
    private: true,
  });
});

test('workspace events include appearance and consolidate workspace loading', async ({ page }) => {
  const result = await page.evaluate(() => {
    const workspace = new window.harness.Workspace({
      container: document.createElement('div'),
      initialLayout: window.harness.fixture,
    });
    const events: import('quilt-vanilla').WorkspaceChange[] = [];
    const errors: unknown[] = [];
    const off = workspace.on('change', (event) => events.push(event));
    workspace.on('error', (error) => errors.push(error));
    workspace.setTheme({ panel: '#123456' });
    workspace.setTabBar({ placement: 'left' });
    workspace.setAutoCollapse('protected');
    workspace.getPane('a')!.setTitle('Updated');
    const preset = workspace.exportWorkspace();
    workspace.loadWorkspace(preset);
    const count = events.length;
    try {
      workspace.loadWorkspace({ version: -1 });
    } catch {
      /* No change event. */
    }
    const unchanged = count === events.length;
    off();
    workspace.setAutoCollapse('disabled');
    const unsubscribed = count === events.length;
    const offThrow = workspace.on('change', () => {
      throw new Error('Consumer listener');
    });
    workspace.setAutoCollapse('enabled');
    offThrow();
    workspace.dispose();
    let disposed = false;
    try {
      workspace.on('change', () => {});
    } catch {
      disposed = true;
    }
    return { events, unchanged, unsubscribed, errors: errors.length, disposed };
  });
  expect(result.events.map((e) => e.changes)).toEqual([
    ['theme'],
    ['tabBar'],
    ['autoCollapse'],
    ['layout'],
    ['layout', 'theme', 'tabBar', 'autoCollapse'],
  ]);
  expect(result).toMatchObject({ unchanged: true, unsubscribed: true, errors: 1, disposed: true });
});

test('default additions follow the activated group and direct closes honor confirmation and permissions', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    let prompts = 0;
    const workspace = new window.harness.Workspace({
      container: document.createElement('div'),
      initialLayout: window.harness.fixture,
      paneTypes: { note: { title: 'Note', confirmClose: true, render: () => {} } },
      confirmClose: () => {
        prompts++;
        return false;
      },
    });
    workspace.getPane('b')!.activate();
    const pane = workspace.addPane('note', { id: 'new' })!;
    const layout = workspace.getLayout();
    const placed =
      layout.root.kind === 'split' &&
      layout.root.children[1].kind === 'group' &&
      layout.root.children[1].panes.includes(pane.id);
    const cancelled = !(await pane.close()) && !pane.isDisposed;
    pane.update({ capabilities: { close: false } });
    const protectedPane = !(await pane.close());
    const forced = await pane.close({ force: true });
    workspace.dispose();
    return { placed, cancelled, protectedPane, forced, prompts };
  });
  expect(result).toEqual({
    placed: true,
    cancelled: true,
    protectedPane: true,
    forced: true,
    prompts: 1,
  });
});

test('pane type updates replace only changed views and reset registration explicitly', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const counts = { first: 0, second: 0, other: 0, cleaned: 0 };
    const first: import('quilt-vanilla').PaneRenderer = ({ onCleanup }) => {
      counts.first++;
      onCleanup(() => counts.cleaned++);
    };
    const second: import('quilt-vanilla').PaneRenderer = () => {
      counts.second++;
    };
    const other: import('quilt-vanilla').PaneRenderer = () => {
      counts.other++;
    };
    const workspace = new window.harness.Workspace({
      container: document.createElement('div'),
      paneTypes: {
        a: { title: 'A', render: first },
        b: { title: 'B', render: other },
      },
    });
    const a = workspace.addPane('a')!;
    workspace.addPane('b');
    workspace.updateOptions({
      paneTypes: { a: { title: 'A', render: first }, b: { title: 'B', render: other } },
    });
    const equivalent = { ...counts };
    workspace.updateOptions({
      paneTypes: { a: { title: 'A', render: second }, b: { title: 'B', render: other } },
    });
    const replaced = { ...counts };
    const alive = !a.isDisposed;
    let rejected = false;
    try {
      workspace.updateOptions({ paneTypes: {}, renderers: {} } as never);
    } catch {
      rejected = true;
    }
    workspace.updateOptions({ paneTypes: undefined, renderers: { a: first, b: other } });
    const cleared = { ...counts };
    workspace.dispose();
    return { equivalent, replaced, cleared, alive, rejected };
  });
  expect(result).toEqual({
    equivalent: { first: 1, second: 0, other: 1, cleaned: 0 },
    replaced: { first: 1, second: 1, other: 1, cleaned: 1 },
    cleared: { first: 2, second: 1, other: 1, cleaned: 1 },
    alive: true,
    rejected: true,
  });
});

test('pane handles remain valid after blocked popouts and successful companion returns', async ({
  page,
}) => {
  await page.evaluate(() => {
    const pane = window.harness.mounted.getPane('a')!;
    Object.assign(window, { trackedPane: pane });
    window.harness.mounted.updateOptions({ openWindow: () => null });
  });
  const blocked = await page.evaluate(async () => {
    const pane = window.harness.mounted.getPane('a')!;
    return { result: await pane.popout(), disposed: pane.isDisposed };
  });
  expect(blocked).toEqual({ result: false, disposed: false });
  await page.evaluate(() => window.harness.mounted.updateOptions({ openWindow: undefined }));
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Pop out', exact: true }).click();
  const popup = await opened;
  await expect(popup.getByRole('textbox', { name: 'A' })).toBeVisible();
  expect(
    await page.evaluate(
      'window.trackedPane === window.harness.mounted.getPane("a") && !window.trackedPane.isDisposed',
    ),
  ).toBe(true);
  await popup.close();
  await expect(page.getByRole('textbox', { name: 'A' })).toBeVisible();
  expect(
    await page.evaluate(
      'window.trackedPane === window.harness.mounted.getPane("a") && !window.trackedPane.isDisposed',
    ),
  ).toBe(true);
});

test('constraint failures preserve the target and handles, and empty groups close without confirmation', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const workspace = new window.harness.Workspace({
      container: document.createElement('div'),
      paneTypes: {
        wide: { title: 'Wide', render: () => {}, create: () => ({ size: { minWidth: 500 } }) },
        narrow: { title: 'Narrow', render: () => {}, create: () => ({ size: { maxWidth: 100 } }) },
      },
    });
    const wide = workspace.addPane('wide')!;
    const before = workspace.exportLayout();
    let failed = false;
    try {
      workspace.addPane('narrow');
    } catch {
      failed = true;
    }
    const unchanged = JSON.stringify(before) === JSON.stringify(workspace.exportLayout());
    const empty = workspace.splitGroup('main', 'horizontal');
    const closed = await workspace.closeGroup(empty);
    const alive = !wide.isDisposed;
    workspace.setAutoCollapse('protected');
    workspace.reset();
    const reset =
      workspace.getPanes().length === 0 &&
      workspace.getAutoCollapse() === 'disabled' &&
      wide.isDisposed;
    workspace.dispose();
    return { failed, unchanged, closed, alive, reset };
  });
  expect(result).toEqual({ failed: true, unchanged: true, closed: true, alive: true, reset: true });
});

test('unsubscribing and disposal suppress callbacks still waiting in the same dispatch', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const workspace = new window.harness.Workspace({ container: document.createElement('div') });
    const calls: string[] = [];
    const first = workspace.on('change', () => {
      calls.push('first');
      second();
    });
    const second = workspace.on('change', () => calls.push('removed'));
    workspace.setAutoCollapse('protected');
    first();
    workspace.on('change', () => {
      calls.push('dispose');
      workspace.dispose();
    });
    workspace.on('change', () => calls.push('late'));
    workspace.setAutoCollapse('enabled');
    return { calls, disposed: workspace.isDisposed };
  });
  expect(result).toEqual({ calls: ['first', 'dispose'], disposed: true });
});
