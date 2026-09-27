import type {
  KeyBinding,
  RegisteredShortcut,
  WorkspaceAction,
  WorkspaceSettings,
} from './types.js';

/** Stable conflict priority. Existing presets retain their original priority. */
export const actionOrder: readonly WorkspaceAction[] = [
  'maximize',
  'addTab',
  'restoreClosedTab',
  'closeActiveTab',
  'closePane',
  'closeEmptyPane',
  'popout',
  'joinSiblingRegion',
  'splitLeft',
  'splitRight',
  'splitUp',
  'splitDown',
  'tabOrientationDefault',
  'tabOrientationHorizontal',
  'tabOrientationVertical',
  'tabDisplayDefault',
  'tabDisplayAutomatic',
  'tabDisplayCompact',
];
const defaults: Partial<Record<WorkspaceAction, readonly KeyBinding[]>> = {
  maximize: [{ key: '`' }, { key: ' ', alt: true }],
  addTab: [{ key: 't' }],
  restoreClosedTab: [{ key: 'r' }],
};
export function registeredShortcuts(options: {
  shortcuts?: WorkspaceSettings['shortcuts'];
}): readonly RegisteredShortcut[] {
  const result: RegisteredShortcut[] = [];
  for (const action of actionOrder) {
    const value =
      options.shortcuts === true
        ? !!defaults[action]
        : typeof options.shortcuts === 'object'
          ? options.shortcuts[action]
          : false;
    if (!value) continue;
    const extended = typeof value === 'object' && 'bindings' in value ? value : undefined;
    const configured = extended ? extended.bindings : value;
    const bindings: readonly KeyBinding[] =
      configured === true
        ? (defaults[action] ?? [])
        : Array.isArray(configured)
          ? configured
          : [configured as KeyBinding];
    const handling = extended?.handling ?? 'quilt';
    if (handling !== 'quilt' && handling !== 'external')
      throw new Error('Invalid shortcut handling');
    const normalized = bindings.map((binding) => {
      if (
        !binding ||
        typeof binding.key !== 'string' ||
        !binding.key ||
        (binding.key !== ' ' && /\s/.test(binding.key))
      )
        throw new Error('Invalid shortcut key');
      for (const modifier of ['ctrl', 'alt', 'shift', 'meta'] as const)
        if (binding[modifier] !== undefined && typeof binding[modifier] !== 'boolean')
          throw new Error(`Invalid shortcut modifier: ${modifier}`);
      return Object.freeze({
        key: binding.key,
        ctrl: !!binding.ctrl,
        alt: !!binding.alt,
        shift: !!binding.shift,
        meta: !!binding.meta,
      });
    });
    if (normalized.length)
      result.push(Object.freeze({ action, handling, bindings: Object.freeze(normalized) }));
  }
  return Object.freeze(result);
}
export function formatShortcut(binding: Readonly<KeyBinding>): string {
  return [
    binding.ctrl && 'Ctrl',
    binding.alt && 'Alt',
    binding.shift && 'Shift',
    binding.meta && 'Meta',
    binding.key === ' '
      ? 'Space'
      : binding.key.length === 1
        ? binding.key.toUpperCase()
        : binding.key,
  ]
    .filter(Boolean)
    .join(' + ');
}
export function ariaShortcut(binding: Readonly<KeyBinding>): string {
  return [
    binding.ctrl && 'Control',
    binding.alt && 'Alt',
    binding.shift && 'Shift',
    binding.meta && 'Meta',
    binding.key === ' ' ? 'Space' : binding.key === '+' ? 'Plus' : binding.key,
  ]
    .filter(Boolean)
    .join('+');
}
