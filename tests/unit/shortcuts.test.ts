import { defaultShortcuts } from 'quilt-vanilla';
import { describe, expect, it } from 'vitest';
import {
  registeredShortcuts,
  formatShortcut,
  ariaShortcut,
  actionOrder,
} from '../../packages/dom/src/shortcut-registration.js';
import type { WorkspaceSettings } from '../../packages/dom/src/types.js';

describe('shortcut registration', () => {
  it('exports a frozen, spreadable preset equivalent to shortcuts true', () => {
    expect(Object.isFrozen(defaultShortcuts)).toBe(true);
    expect(registeredShortcuts({ shortcuts: defaultShortcuts })).toEqual(
      registeredShortcuts({ shortcuts: true }),
    );
    expect(
      registeredShortcuts({ shortcuts: { ...defaultShortcuts, addTab: false } }).map(
        (entry) => entry.action,
      ),
    ).toEqual(['maximize', 'restoreClosedTab']);
  });
  it('keeps the existing presets and conflict priority', () => {
    expect(registeredShortcuts({})).toEqual([]);
    expect(registeredShortcuts({ shortcuts: false })).toEqual([]);
    const entries = registeredShortcuts({ shortcuts: true });
    expect(entries.map((entry) => entry.action)).toEqual([
      'maximize',
      'addTab',
      'restoreClosedTab',
    ]);
    expect(entries[0]!.bindings.map(formatShortcut)).toEqual(['`', 'Alt + Space']);
    expect(actionOrder.slice(0, 3)).toEqual(entries.map((entry) => entry.action));
    expect(registeredShortcuts({ shortcuts: { closePane: true, maximize: [] } })).toEqual([]);
  });
  it('normalizes old and external registrations into independent frozen snapshots', () => {
    const key = { key: 'w', meta: true };
    const entries = registeredShortcuts({
      shortcuts: {
        maximize: { key: 'm' },
        closePane: { bindings: [key], handling: 'external' },
        addTab: [{ key: 't', ctrl: true }],
      },
    });
    expect(entries.map((entry) => entry.action)).toEqual(['maximize', 'addTab', 'closePane']);
    const external = entries[2]!;
    expect(external.handling).toBe('external');
    key.key = 'q';
    expect(external.bindings[0]!.key).toBe('w');
    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(external)).toBe(true);
    expect(Object.isFrozen(external.bindings)).toBe(true);
    expect(Object.isFrozen(external.bindings[0])).toBe(true);
  });
  it('formats display and ARIA independently', () => {
    expect(formatShortcut({ key: 'a', ctrl: true, shift: true })).toBe('Ctrl + Shift + A');
    expect(ariaShortcut({ key: ' ', alt: true })).toBe('Alt+Space');
    expect(ariaShortcut({ key: '+', ctrl: true })).toBe('Control+Plus');
    expect(ariaShortcut({ key: 'ArrowRight', meta: true })).toBe('Meta+ArrowRight');
    expect(formatShortcut({ key: '`' })).toBe('`');
  });
  it.each([
    { maximize: { key: '' } },
    { maximize: { key: 'two keys' } },
    { maximize: { key: 'x', ctrl: 'yes' } },
    { maximize: { bindings: { key: 'x' }, handling: 'unknown' } },
  ])('rejects invalid registrations: %j', (shortcuts) => {
    expect(() => registeredShortcuts({ shortcuts } as WorkspaceSettings)).toThrow();
  });
});
