import type { ActionContext, ResolvedLayoutOptions, WorkspaceAction } from './types.js';
import type { Scope } from './lifetime.js';
import { registeredShortcuts } from './shortcut-registration.js';
export function shortcutEnabled(options: ResolvedLayoutOptions, key: 'middleClickClose') {
  return (
    options.shortcuts === true ||
    (typeof options.shortcuts === 'object' && !!options.shortcuts[key])
  );
}
const hovered = new WeakMap<Document, HTMLElement>();
export function bindShortcuts(
  root: HTMLElement,
  options: ResolvedLayoutOptions,
  scope: Scope,
  canExecute: (action: WorkspaceAction, context?: ActionContext) => boolean,
  execute: (action: WorkspaceAction, context?: ActionContext) => Promise<boolean>,
  menuTarget: () =>
    { dialog: HTMLDialogElement; context: ActionContext; close(): void } | undefined,
) {
  const doc = root.ownerDocument;
  let hoveredGroup: string | undefined;
  scope.listen(root, 'pointerover', (event) => {
    hovered.set(doc, root);
    hoveredGroup = (event.target as Element).closest<HTMLElement>('.layouts-group')?.dataset.nodeId;
  });
  scope.listen(root, 'pointerleave', () => {
    if (hovered.get(doc) === root) hovered.delete(doc);
    hoveredGroup = undefined;
  });
  scope.add(() => {
    if (hovered.get(doc) === root) hovered.delete(doc);
  });
  const ownsFocus = () =>
    (doc.activeElement?.closest<HTMLElement>('.layouts') ?? hovered.get(doc)) === root;
  const context = (): ActionContext => {
    if (!ownsFocus()) return {};
    const menu = menuTarget();
    if (menu) return menu.context;
    const focusedGroup = doc.activeElement?.closest<HTMLElement>('.layouts-group')?.dataset.nodeId;
    const groupId = (hovered.get(doc) === root ? hoveredGroup : undefined) ?? focusedGroup;
    return groupId ? { groupId } : {};
  };
  scope.listen(doc, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    const target = e.target as HTMLElement | null;
    if (!ownsFocus() || e.defaultPrevented || e.repeat || e.isComposing) return;
    const menu = menuTarget();
    if (
      target?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ) ||
      Array.from(doc.querySelectorAll('dialog[open]')).some((dialog) => dialog !== menu?.dialog)
    )
      return;
    const entry = registeredShortcuts(options).find(
      (entry) =>
        entry.handling === 'quilt' &&
        entry.bindings.some(
          (binding) =>
            e.key.toLowerCase() === binding.key.toLowerCase() &&
            e.ctrlKey === !!binding.ctrl &&
            e.altKey === !!binding.alt &&
            e.shiftKey === !!binding.shift &&
            e.metaKey === !!binding.meta,
        ),
    );
    const actionContext = context();
    if (!entry || !canExecute(entry.action, actionContext)) return;
    e.preventDefault();
    menu?.close();
    void execute(entry.action, actionContext);
  });
  return context;
}
