import { findNode } from 'quilt-core';
import type { Pane } from 'quilt-core';
import type { CloseRequest, ResolvedLayoutOptions } from './types.js';
import { el, Scope } from './lifetime.js';
import { message } from './messages.js';
export function closeRequests(
  root: HTMLElement,
  options: ResolvedLayoutOptions,
  scope: Scope,
  report: (error: unknown) => void,
) {
  let pending: AbortController | undefined;
  let disposed = false;
  scope.add(() => {
    disposed = true;
    pending?.abort();
  });
  const signature = (panes: readonly Pane[]) => JSON.stringify(panes);
  return async (id: string, kind: 'pane' | 'group' = 'pane'): Promise<boolean> => {
    if (pending || disposed) return false;
    const controller = new AbortController();
    pending = controller;
    const collect = (): Pane[] => {
      const snapshot = options.store.getSnapshot();
      const node = kind === 'group' ? findNode(snapshot.root, id) : undefined;
      const ids = kind === 'group' ? (node?.kind === 'group' ? node.panes : []) : [id];
      return ids.map((key) => snapshot.panes[key]).filter((pane): pane is Pane => !!pane);
    };
    const panes = collect();
    const requiringConfirmation = panes.filter(
      (pane) =>
        pane.confirmClose ??
        options.registry?.list().find((entry) => entry.type === pane.type)?.confirmClose ??
        false,
    );
    const request: CloseRequest = {
      panes,
      requiringConfirmation,
      signal: controller.signal,
      ...(kind === 'group' ? { groupId: id } : {}),
    };
    let cleanup = () => {};
    try {
      const target = kind === 'group' ? findNode(options.store.getSnapshot().root, id) : undefined;
      if (
        (!panes.length && target?.kind !== 'group') ||
        panes.some((pane) => !options.store.can(pane.id, 'close'))
      )
        return false;
      if (requiringConfirmation.length) {
        const decision = options.confirmClose
          ? Promise.resolve(options.confirmClose(request))
          : new Promise<boolean>((resolve) => {
              const dialog = el(root.ownerDocument, 'dialog', 'layouts-menu layouts-confirm');
              dialog.setAttribute('aria-label', message(options, 'Close selected panes?'));
              const title = el(
                root.ownerDocument,
                'h2',
                '',
                message(options, 'Close selected panes?'),
              );
              const list = el(
                root.ownerDocument,
                'p',
                '',
                requiringConfirmation.map((pane) => pane.title).join(', '),
              );
              const cancel = el(
                root.ownerDocument,
                'button',
                'layouts-button',
                message(options, 'Cancel'),
              );
              const close = el(
                root.ownerDocument,
                'button',
                'layouts-button',
                message(options, 'Close'),
              );
              cancel.type = close.type = 'button';
              cancel.onclick = () => resolve(false);
              close.onclick = () => resolve(true);
              dialog.oncancel = (event) => {
                event.preventDefault();
                resolve(false);
              };
              dialog.append(title, list, cancel, close);
              root.append(dialog);
              cleanup = () => dialog.remove();
              dialog.showModal();
              cancel.focus();
            });
        const aborted = new Promise<boolean>((resolve) =>
          controller.signal.addEventListener('abort', () => resolve(false), { once: true }),
        );
        const unsubscribe = options.store.subscribe((event) => {
          if (event.action === 'load' || signature(collect()) !== signature(panes))
            controller.abort();
        });
        const previousCleanup = cleanup;
        cleanup = () => {
          unsubscribe();
          previousCleanup();
        };
        if (!(await Promise.race([decision, aborted]))) return false;
      }
      if (
        controller.signal.aborted ||
        signature(collect()) !== signature(panes) ||
        panes.some((pane) => !options.store.can(pane.id, 'close'))
      )
        return false;
      if (kind === 'group') options.store.closeGroup(id, { source: 'user' });
      else options.store.close(id, { source: 'user' });
      return true;
    } catch (error) {
      report(error);
      return false;
    } finally {
      cleanup();
      controller.abort();
      if (pending === controller) pending = undefined;
    }
  };
}
