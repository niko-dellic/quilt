import { test, expect } from '@playwright/test';
import type {} from './harness.js';
import type {} from './integration.js';
test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
});
test('owned stores initialize, restore presets, and dispose with their workspace', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const { Workspace, fixture } = window.harness;
    const host = document.createElement('div');
    document.body.append(host);
    const empty = new Workspace({
      container: host,
    });
    const emptyCount = Object.keys(empty.getLayout().panes).length;
    empty.dispose();
    const first = new Workspace({
      container: host,
      initialLayout: fixture,
      theme: { panel: '#123456' },
    });
    first.setAutoCollapse('protected');
    const preset = first.exportWorkspace();
    first.dispose();
    const restored = new Workspace({
      container: host,
      initialWorkspace: preset,
    });
    const roundtrip = restored.exportWorkspace();
    const store = restored;
    restored.dispose();
    restored.dispose();
    let disposed = false;
    try {
      store.on('change', () => {});
    } catch {
      disposed = true;
    }
    return { emptyCount, roundtrip, preset, disposed, children: host.childElementCount };
  });
  expect(result.emptyCount).toBe(0);
  expect(result.roundtrip).toEqual(result.preset);
  expect(result.disposed).toBe(true);
  expect(result.children).toBe(0);
});
test('invalid configuration allocates no workspace root or views', async ({ page }) => {
  const result = await page.evaluate(() => {
    const host = document.createElement('div');
    let views = 0,
      rejected = 0;
    const { Workspace, fixture, store } = window.harness;
    const invalid = [
      { store },
      { initialLayout: fixture, initialWorkspace: window.harness.mounted.exportWorkspace() },
      { initialLayout: {} },
      { initialWorkspace: { version: 99 } },
      { theme: { headerHeight: -1 } },
    ];
    for (const options of invalid) {
      try {
        new Workspace({
          container: host,
          ...{
            ...options,
            renderers: {
              test: () => {
                views++;
              },
            },
          },
        } as never);
      } catch {
        rejected++;
      }
    }
    return { views, rejected, children: host.childElementCount };
  });
  expect(result).toEqual({ views: 0, rejected: 5, children: 0 });
});
test('partial mount cleanup, retry, replacement, and late cleanup survive throwing callbacks', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const { Workspace, fixture } = window.harness;
    const events: string[] = [],
      errors: string[] = [];
    let fail = true;
    let late: ((callback: () => void) => void) | undefined;
    const host = document.createElement('div');
    const mounted = new Workspace({
      container: host,
      initialLayout: fixture,
      onError: (error) => errors.push(String(error)),
      renderers: {
        test: ({ pane, signal, onCleanup }) => {
          if (pane.id === 'b') return;
          signal.addEventListener('abort', () => events.push('abort'));
          onCleanup(() => {
            events.push('first');
          });
          onCleanup(() => {
            events.push('second');
            throw new Error('cleanup failed');
          });
          late = onCleanup;
          if (fail) throw new Error('mount failed');
          return {
            dispose() {
              events.push('dispose');
              throw new Error('dispose failed');
            },
          };
        },
      },
    });
    const failed = [...events];
    fail = false;
    mounted.retryPane('a');
    mounted.updateOptions({
      renderers: {
        test: ({ element }) => {
          element.textContent = 'Replacement';
        },
      },
    });
    late!(() => events.push('late'));
    const replacements = host.querySelectorAll('.layouts-pane').length;
    mounted.dispose();
    mounted.dispose();
    return { failed, events, errors, replacements };
  });
  expect(result.failed).toEqual(['abort', 'second', 'first']);
  expect(result.events).toEqual([
    'abort',
    'second',
    'first',
    'abort',
    'dispose',
    'second',
    'first',
    'late',
  ]);
  expect(result.replacements).toBe(2);
  expect(result.errors).toHaveLength(4);
});
test('view scopes remain alive during movement and abort on workspace disposal', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const signals: AbortSignal[] = [];
    const host = document.createElement('div');
    const mounted = new window.harness.Workspace({
      container: host,
      initialLayout: window.harness.fixture,
      renderers: {
        test: ({ signal }) => {
          signals.push(signal);
        },
      },
    });
    mounted.movePane('b', 'left');
    mounted.activatePane('a');
    mounted.maximize('left');
    mounted.maximize(null);
    const before = signals.map((signal) => signal.aborted);
    mounted.dispose();
    return { before, after: signals.map((signal) => signal.aborted) };
  });
  expect(result.before).toEqual([false, false]);
  expect(result.after).toEqual([true, true]);
});
test('React readiness is once per live Strict Mode mount; initial props do not reset it', async ({
  page,
}) => {
  await page.goto('/tests/browser/integration.html');
  await expect(page.getByLabel('Provider')).toHaveText('context 0');
  await page.getByRole('textbox').fill('retained');
  await page.getByRole('button', { name: 'Rerender' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('retained');
  const result = await page.evaluate(() => ({
    ready: window.integration.stats.ready,
    early: window.integration.stats.early,
    title: window.integration.store.getLayout().panes.a!.title,
  }));
  expect(result.ready).toBe(1);
  expect(result.early.length).toBeGreaterThan(0);
  expect(result.early.every((error) => error.includes('not ready'))).toBe(true);
  expect(result.title).toBe('Initial 0');
  await page.evaluate(() => window.integration.dispose());
  expect(
    await page.evaluate(() => {
      try {
        window.integration.store.on('change', () => {});
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
});
test('initialization failure rolls back roots and companion polling', async ({ page }) => {
  const result = await page.evaluate(() => {
    const originalObserver = window.ResizeObserver;
    const originalInterval = window.setInterval;
    const originalClear = window.clearInterval;
    const timers = new Set<number>();
    const host = document.createElement('div');
    document.body.append(host);
    window.setInterval = ((...args: Parameters<typeof window.setInterval>) => {
      const id = originalInterval(...args);
      timers.add(id);
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = (id) => {
      timers.delete(id as number);
      originalClear(id);
    };
    window.ResizeObserver = class extends originalObserver {
      override observe() {
        throw new Error('Observer setup failed');
      }
    };
    let failed = false;
    try {
      new window.harness.Workspace({
        container: host,
      });
    } catch {
      failed = true;
    } finally {
      window.ResizeObserver = originalObserver;
      window.setInterval = originalInterval;
      window.clearInterval = originalClear;
    }
    return { failed, children: host.childElementCount, timers: timers.size };
  });
  expect(result).toEqual({ failed: true, children: 0, timers: 0 });
});
test('failed and pending companions release their scopes without discarding source data', async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'owned';
    document.body.append(host);
    let mode = 'reject';
    let childCleanups = 0,
      sourceCleanups = 0;
    const mounted = new window.harness.Workspace({
      container: host,
      initialLayout: window.harness.fixture,
      renderers: {
        test: ({ location, onCleanup, signal }) => {
          if (location === 'main') {
            onCleanup(() => {
              sourceCleanups++;
              host.dataset.source = String(sourceCleanups);
            });
            return;
          }
          onCleanup(() => {
            childCleanups++;
            host.dataset.child = String(childCleanups);
            host.dataset.aborted = String(signal.aborted);
            throw new Error('Companion cleanup failed');
          });
          return {
            dispose() {
              throw new Error('Companion dispose failed');
            },
            ready:
              mode === 'reject'
                ? Promise.reject(new Error('Not ready'))
                : new Promise<void>(() => {}),
          };
        },
      },
    });
    const open = document.createElement('button');
    open.id = 'owned-open';
    open.textContent = 'Owned popup';
    open.onclick = () => {
      void mounted.popout('a').then((value) => {
        host.dataset.opened = String(value);
      });
    };
    const dispose = document.createElement('button');
    dispose.id = 'owned-dispose';
    dispose.textContent = 'Dispose owned';
    dispose.onclick = () => mounted.dispose();
    const pending = document.createElement('button');
    pending.id = 'owned-pending';
    pending.textContent = 'Pending mode';
    pending.onclick = () => {
      mode = 'pending';
    };
    document.body.append(open, dispose, pending);
  });
  const rejected = page.waitForEvent('popup');
  await page.locator('#owned-open').click();
  const first = await rejected;
  await expect.poll(() => first.isClosed()).toBe(true);
  await expect(page.locator('#owned')).toHaveAttribute('data-child', '1');
  await expect(page.locator('#owned')).toHaveAttribute('data-aborted', 'true');
  await expect(page.locator('#owned')).not.toHaveAttribute('data-source');
  await page.locator('#owned-pending').click();
  const pending = page.waitForEvent('popup');
  await page.locator('#owned-open').click();
  const second = await pending;
  await page.locator('#owned-dispose').click();
  await expect.poll(() => second.isClosed()).toBe(true);
  await expect(page.locator('#owned')).toHaveAttribute('data-child', '2');
  await expect(page.locator('#owned')).toHaveAttribute('data-source', '2');
  await expect(page.locator('#owned')).toHaveAttribute('data-opened', 'false');
});
test('React preset appearance survives callback updates and remount releases its old store', async ({
  page,
}) => {
  await page.goto('/tests/browser/integration.html?preset');
  await expect(page.getByLabel('Provider')).toHaveText('context 0');
  await page.getByRole('button', { name: 'Rerender' }).click();
  const preset = await page.evaluate(() => window.integration.handle.current!.exportWorkspace());
  expect(preset.theme).toEqual({ panel: '#123456' });
  expect(preset.tabBar).toEqual({ placement: 'left' });
  expect(preset.autoCollapse).toBe('protected');
  await page.getByRole('button', { name: 'Remount' }).click();
  await expect(page.getByLabel('Provider')).toHaveText('context 1');
  const lifecycle = await page.evaluate(() => {
    const { ownedStores, stats } = window.integration;
    return {
      ready: stats.ready,
      disposed: ownedStores.map((store) => {
        try {
          const unsubscribe = store.on('change', () => {});
          unsubscribe();
          return false;
        } catch {
          return true;
        }
      }),
    };
  });
  expect(lifecycle).toEqual({ ready: 2, disposed: [true, false] });
});
