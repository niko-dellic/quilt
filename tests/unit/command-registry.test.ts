import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry, ShortcutConflictError } from '../../packages/dom/src/command-registry.js';

const command = (id = 'app.save' as const) => ({ id, label: 'Save document', execute: () => {} });

describe('command and shortcut registry', () => {
  it('detects conflicts using keyboard matching rules and includes external handlers', () => {
    const registry = new CommandRegistry(
      {
        shortcuts: {
          maximize: [{ key: 'M' }, { key: 'm', ctrl: false }],
          addTab: { bindings: { key: 'm' }, handling: 'external' },
          closePane: { key: 'm', ctrl: true },
        },
      },
      vi.fn(),
    );
    expect(registry.getShortcutConflicts()).toEqual([
      {
        binding: { key: 'm', ctrl: false, alt: false, shift: false, meta: false },
        actions: ['maximize', 'addTab'],
      },
    ]);
    expect(Object.isFrozen(registry.getShortcutConflicts()[0]!.actions)).toBe(true);
    registry.dispose();
  });
  it('strict mode rejects conflicts before committing changes', () => {
    const registry = new CommandRegistry(
      { shortcuts: { maximize: { key: 'm' } }, shortcutConflictPolicy: 'error' },
      vi.fn(),
    );
    expect(() => registry.registerShortcut('addTab', { key: 'M' })).toThrow(ShortcutConflictError);
    expect(registry.getShortcuts().map((entry) => entry.action)).toEqual(['maximize']);
    expect(() =>
      registry.prepare({
        commands: [command()],
        shortcuts: {
          maximize: { key: 'm' },
          'app.save': { key: 'M' },
        },
      }),
    ).toThrow(ShortcutConflictError);
    expect(registry.getCommands()).toEqual([]);
    expect(registry.getShortcutConflicts()).toEqual([]);
  });
  it('refuses to enable strict mode over existing conflicts', () => {
    const registry = new CommandRegistry(
      { shortcuts: { maximize: { key: 'm' }, addTab: { key: 'm' } } },
      vi.fn(),
    );
    expect(() => registry.prepare({ shortcutConflictPolicy: 'error' })).toThrow(
      ShortcutConflictError,
    );
    expect(registry.getShortcutConflicts()).toHaveLength(1);
    registry.registerShortcut('closePane', { key: 'm' });
    expect(registry.getShortcutConflicts()[0]!.actions).toHaveLength(3);
  });
  it('warns once per changed conflict set and isolates warning callback failures', () => {
    const report = vi.fn(),
      warn = vi.fn();
    const registry = new CommandRegistry(
      { shortcutConflictPolicy: 'warn', onShortcutConflict: warn },
      report,
    );
    registry.registerShortcut('maximize', { key: 'm' });
    const remove = registry.registerShortcut('addTab', { key: 'm' });
    expect(warn).toHaveBeenCalledTimes(1);
    registry.prepare({})();
    expect(warn).toHaveBeenCalledTimes(1);
    remove();
    registry.prepare({
      onShortcutConflict: () => {
        throw new Error('reporter failed');
      },
    })();
    registry.registerShortcut('addTab', { key: 'm' });
    expect(report).toHaveBeenCalledOnce();
    expect(registry.getShortcutConflicts()).toHaveLength(1);
  });
  it('uses console warnings when no callback is supplied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      new CommandRegistry(
        {
          shortcutConflictPolicy: 'warn',
          shortcuts: { maximize: { key: 'm' }, addTab: { key: 'm' } },
        },
        vi.fn(),
      );
      expect(warn).toHaveBeenCalledWith(expect.any(ShortcutConflictError));
    } finally {
      warn.mockRestore();
    }
  });
  it('cleanup never removes a newer binding or restores a displaced one', () => {
    const registry = new CommandRegistry({ shortcuts: true }, vi.fn());
    const old = registry.registerShortcut('maximize', { key: 'm' });
    const fresh = registry.registerShortcut('maximize', { key: 'n' });
    old();
    expect(registry.getShortcuts()[0]!.bindings[0]!.key).toBe('n');
    fresh();
    fresh();
    old();
    expect(registry.getShortcuts().some((entry) => entry.action === 'maximize')).toBe(false);
    expect(registry.getShortcuts().map((entry) => entry.action)).toEqual([
      'addTab',
      'restoreClosedTab',
    ]);
  });
  it('separates command lifetime from bindings and cleans up both on removal', () => {
    const registry = new CommandRegistry({}, vi.fn());
    const remove = registry.registerCommand(command());
    const signal = registry.getCommand('app.save')!.controller.signal;
    const unbind = registry.registerShortcut('app.save', { key: 's', ctrl: true });
    unbind();
    expect(signal.aborted).toBe(false);
    registry.registerShortcut('app.save', { key: 's', meta: true });
    remove();
    expect(signal.aborted).toBe(true);
    expect(registry.getCommands()).toEqual([]);
    expect(registry.getShortcuts()).toEqual([]);
    registry.registerCommand(command());
    remove();
    expect(registry.getCommands()).toHaveLength(1);
    registry.dispose();
    unbind();
    remove();
    expect(registry.getCommands()).toEqual([]);
  });
  it('validates command IDs and refuses duplicates and unknown targets', () => {
    const registry = new CommandRegistry({}, vi.fn());
    expect(() => registry.registerShortcut('app.unknown', { key: 'x' })).toThrow(
      'Unknown shortcut command',
    );
    expect(() => registry.registerCommand({ ...command(), id: 'app.' })).toThrow();
    registry.registerCommand(command());
    expect(() => registry.registerCommand(command())).toThrow('Duplicate command');
    expect(() => registry.prepare({ commands: [command(), command()] })).toThrow(
      'Duplicate command',
    );
    expect(registry.getCommands()).toEqual([{ id: 'app.save', label: 'Save document' }]);
  });
  it('options replacement is atomic and invalidates old binding cleanup tokens', () => {
    const registry = new CommandRegistry({}, vi.fn());
    const old = registry.registerShortcut('maximize', { key: 'm' });
    registry.prepare({ shortcuts: { maximize: { key: 'n' } } })();
    old();
    expect(registry.getShortcuts()[0]!.bindings[0]!.key).toBe('n');
    registry.prepare({ shortcuts: undefined })();
    expect(registry.getShortcuts()).toEqual([]);
  });
  it('replacing a callback aborts its old lifetime without losing its binding', () => {
    const original = command();
    const registry = new CommandRegistry(
      { commands: [original], shortcuts: { 'app.save': { key: 's' } } },
      vi.fn(),
    );
    const signal = registry.getCommand('app.save')!.controller.signal;
    registry.prepare({ commands: [original] })();
    expect(signal.aborted).toBe(false);
    registry.prepare({ commands: [{ ...original, execute: () => true }] })();
    expect(signal.aborted).toBe(true);
    expect(registry.getShortcuts()).toHaveLength(1);
    const updated = registry.getCommand('app.save')!.controller.signal;
    registry.dispose();
    expect(updated.aborted).toBe(true);
    expect(() => registry.registerCommand(original)).toThrow('disposed');
  });
  it('declarative ownership invalidates old cleanup while relabeling preserves execution lifetime', () => {
    const registry = new CommandRegistry({}, vi.fn());
    const original = command();
    const remove = registry.registerCommand(original);
    const signal = registry.getCommand('app.save')!.controller.signal;
    registry.registerShortcut('app.save', { key: 's' });
    registry.prepare({ commands: [{ ...original, label: 'Save changes' }] })();
    remove();
    expect(registry.getCommands()).toEqual([{ id: 'app.save', label: 'Save changes' }]);
    expect(registry.getShortcuts()).toHaveLength(1);
    expect(signal.aborted).toBe(false);
    registry.dispose();
    expect(signal.aborted).toBe(true);
  });
});
