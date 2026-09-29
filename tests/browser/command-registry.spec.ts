import { expect, test } from '@playwright/test';
import type {} from './harness.js';

test('strict updates reject conflicts without changing bindings, commands, theme, or menu focus', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  const maximize = page.getByRole('button', { name: 'Maximize region', exact: true });
  await maximize.focus();
  const result = await page.evaluate(() => {
    const w = window.harness.mounted;
    w.updateOptions({ shortcutConflictPolicy: 'error' });
    const before = JSON.stringify(w.exportWorkspace());
    const events: string[] = [];
    const off = w.on('change', (event) => events.push(event.action));
    let error: { name: string; conflicts: unknown } | undefined;
    try {
      w.updateOptions({
        commands: [{ id: 'app.save', label: 'Save', execute: () => {} }],
        shortcuts: { maximize: { key: 'm' }, 'app.save': { key: 'M' } },
        theme: { panel: '#ff0000' },
      });
    } catch (caught) {
      const value = caught as { name: string; conflicts: unknown };
      error = { name: value.name, conflicts: value.conflicts };
    }
    off();
    return {
      name: error?.name,
      conflicts: error?.conflicts,
      stable: before === JSON.stringify(w.exportWorkspace()),
      commands: w.getCommands(),
      entries: w.getShortcuts().map((entry) => entry.action),
      events,
    };
  });
  expect(result).toMatchObject({
    name: 'ShortcutConflictError',
    stable: true,
    commands: [],
    entries: ['maximize', 'addTab', 'restoreClosedTab'],
    events: [],
    conflicts: [{ actions: ['maximize', 'app.save'], binding: { key: 'm' } }],
  });
  await expect(maximize).toBeFocused();
  await expect(maximize.locator('kbd')).toHaveText('`');
});

test('incremental updates retain the menu and unrelated bindings; stale cleanup does not remove replacements', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html?shortcuts');
  await page.getByRole('button', { name: 'A actions', exact: true }).click();
  const maximize = page.getByRole('button', { name: 'Maximize region', exact: true });
  await maximize.focus();
  const result = await page.evaluate(() => {
    const w = window.harness.mounted;
    const events: string[][] = [];
    const off = w.on('change', (event) => events.push([...event.changes]));
    const old = w.registerShortcut('maximize', { key: 'm' });
    w.registerShortcut('maximize', { key: 'n' });
    old();
    old();
    // This update must not reapply the original shortcuts: true configuration.
    w.updateOptions({ formatShortcut: (binding) => binding.key.toUpperCase() });
    off();
    return { events, keys: w.getShortcuts().map((entry) => entry.bindings[0]!.key) };
  });
  expect(result.keys).toEqual(['n', 't', 'r']);
  expect(result.events).toEqual([['shortcuts'], ['shortcuts'], ['shortcuts']]);
  await expect(maximize).toBeFocused();
  await expect(maximize.locator('kbd')).toHaveText('N');
  await page.keyboard.press('n');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBe('left');
});

test('custom commands support keyboard execution, availability, remapping, external handling and disposal', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  await page.evaluate(() => {
    const w = window.harness.mounted;
    const status = document.createElement('output');
    status.id = 'command-status';
    document.body.append(status);
    let calls = 0;
    w.registerCommand({
      id: 'app.saveDocument',
      label: 'Save document',
      enabled: ({ paneId }) => paneId === 'a',
      execute: ({ groupId, paneId, signal }) => {
        status.textContent = `${++calls}:${groupId}:${paneId}:${signal.aborted}`;
      },
    });
    w.registerShortcut('app.saveDocument', { key: 's', ctrl: true });
    w.updateOptions({ theme: { panel: '#123456' } });
  });
  // A hovered region wins over focus. Clear the platform-dependent initial pointer position.
  await page.locator('#open').hover();
  await page.getByRole('tab', { name: 'B', exact: true }).focus();
  await page.keyboard.press('Control+s');
  await expect(page.locator('#command-status')).toBeEmpty();
  await page.getByRole('tab', { name: 'A', exact: true }).focus();
  await page.keyboard.press('Control+s');
  await expect(page.locator('#command-status')).toHaveText('1:left:a:false');
  await page.evaluate(() =>
    window.harness.mounted.registerShortcut('app.saveDocument', {
      bindings: { key: 's', ctrl: true },
      handling: 'external',
    }),
  );
  await page.keyboard.press('Control+s');
  await expect(page.locator('#command-status')).toHaveText('1:left:a:false');
  expect(
    await page.evaluate(() =>
      window.harness.mounted.executeAction('app.saveDocument', { paneId: 'a' }),
    ),
  ).toBe(true);
  await expect(page.locator('#command-status')).toHaveText('2:left:a:false');
  expect(await page.evaluate(() => window.harness.mounted.getCommands())).toEqual([
    { id: 'app.saveDocument', label: 'Save document' },
  ]);
  await page.evaluate(() => window.harness.mounted.dispose());
  expect(await page.evaluate(() => window.harness.mounted.executeAction('app.saveDocument'))).toBe(
    false,
  );
});

test('conflict warnings include external commands and preserve deterministic priority', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const warnings = await page.evaluate(() => {
    const warnings: string[][] = [];
    const w = window.harness.mounted;
    w.updateOptions({
      shortcutConflictPolicy: 'warn',
      onShortcutConflict: (conflicts) => warnings.push([...conflicts[0]!.actions]),
      commands: [
        {
          id: 'app.save',
          label: 'Save',
          execute: () => {
            throw Error('Custom command must lose to maximize');
          },
        },
      ],
      shortcuts: { maximize: { key: 'm' }, 'app.save': { key: 'M' } },
    });
    w.updateOptions({ theme: {} });
    const remove = w.registerShortcut('addTab', { bindings: { key: 'm' }, handling: 'external' });
    remove();
    return warnings;
  });
  expect(warnings).toEqual([
    ['maximize', 'app.save'],
    ['maximize', 'addTab', 'app.save'],
    ['maximize', 'app.save'],
  ]);
  await page.getByRole('tab', { name: 'A', exact: true }).focus();
  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.harness.mounted.getLayout().maximized)).toBe('left');
  expect(await page.evaluate(() => window.harness.stats.errors)).toEqual([]);
});

test('command removal aborts pending execution, removes bindings, and callback errors report safely', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(async () => {
    const w = window.harness.mounted;
    let signal: AbortSignal | undefined;
    let finish!: () => void;
    const remove = w.registerCommand({
      id: 'app.wait',
      label: 'Wait',
      execute: (context) => {
        signal = context.signal;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    });
    w.registerShortcut('app.wait', { key: 'x' });
    const pending = w.executeAction('app.wait');
    remove();
    remove();
    finish();
    const completed = await pending;
    w.registerCommand({
      id: 'app.broken',
      label: 'Broken',
      execute: () => {
        throw Error('Command failed');
      },
    });
    const failure = await w.executeAction('app.broken');
    w.registerCommand({
      id: 'app.disabled',
      label: 'Disabled',
      enabled: () => {
        throw Error('Availability failed');
      },
      execute: () => true,
    });
    const enabled = w.canExecuteAction('app.disabled');
    return {
      aborted: signal!.aborted,
      completed,
      failure,
      enabled,
      shortcuts: w.getShortcuts(),
      errors: window.harness.stats.errors,
    };
  });
  expect(result).toEqual({
    aborted: true,
    completed: false,
    failure: false,
    enabled: false,
    shortcuts: [],
    errors: ['Error: Command failed', 'Error: Availability failed'],
  });
});

test('React supports command props, callbacks, ref registration, and removal without remounting content', async ({
  page,
}) => {
  await page.goto('/tests/browser/commands-react.html');
  await page.getByRole('textbox', { name: 'Retained text' }).fill('retain me');
  await expect(page.getByLabel('Warnings')).toHaveText('1');
  await page.getByRole('button', { name: 'Remap custom command' }).click();
  await page.getByRole('tab', { name: 'Notes', exact: true }).focus();
  await page.keyboard.press('s');
  await expect(page.getByLabel('Executions')).toHaveText('1');
  await page.getByRole('button', { name: 'Execute custom command' }).click();
  await expect(page.getByLabel('Executions')).toHaveText('2');
  await page.getByRole('button', { name: 'Toggle availability' }).click();
  await page.getByRole('button', { name: 'Execute custom command' }).click();
  await expect(page.getByLabel('Executions')).toHaveText('2');
  await page.getByRole('button', { name: 'Toggle availability' }).click();
  await page.getByRole('button', { name: 'Execute custom command' }).click();
  await expect(page.getByLabel('Executions')).toHaveText('3');
  await page.getByRole('button', { name: 'Remove commands' }).click();
  await page.getByRole('button', { name: 'Execute custom command' }).click();
  await page.getByRole('tab', { name: 'Notes', exact: true }).focus();
  await page.keyboard.press('s');
  await expect(page.getByLabel('Executions')).toHaveText('3');
  await expect(page.getByRole('textbox', { name: 'Retained text' })).toHaveValue('retain me');
});

test('clearing imperative commands through options notifies subscribers even without bindings', async ({
  page,
}) => {
  await page.goto('/tests/browser/harness.html');
  const result = await page.evaluate(() => {
    const w = window.harness.mounted;
    w.registerCommand({ id: 'app.clear', label: 'Clear', execute: () => {} });
    const changes: string[][] = [];
    const off = w.on('change', (event) => changes.push([...event.changes]));
    w.updateOptions({ commands: undefined });
    off();
    return { changes, commands: w.getCommands() };
  });
  expect(result).toEqual({ changes: [['commands']], commands: [] });
});
