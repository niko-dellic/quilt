import { findNode, findParent, groups } from 'quilt-core';
import type { Group, Pane } from 'quilt-core';
import type {
  ActionContext,
  CommandId,
  CommandContext,
  ResolvedLayoutOptions,
  WorkspaceAction,
} from './types.js';
import { isWorkspaceAction } from './shortcut-registration.js';
import type { CommandRegistry } from './command-registry.js';

export function createActions(
  options: ResolvedLayoutOptions,
  dependencies: {
    registry: CommandRegistry;
    context(): ActionContext;
    disposed(): boolean;
    create(action: WorkspaceAction, group: Group, pane: Pane | undefined): void;
    close(id: string, kind?: 'pane' | 'group'): Promise<boolean>;
    popout(id: string): Promise<boolean>;
    report(error: unknown): void;
  },
) {
  function resolve(context?: ActionContext) {
    const layout = options.store.getSnapshot();
    const target =
      context?.groupId !== undefined || context?.paneId !== undefined
        ? context
        : dependencies.context();
    const id =
      target.groupId ??
      (target.paneId === undefined
        ? undefined
        : groups(layout.root).find((group) => group.panes.includes(target.paneId!))?.id);
    const node = id === undefined ? undefined : findNode(layout.root, id);
    const group = node?.kind === 'group' ? node : undefined;
    const paneId = target.paneId ?? group?.active;
    const pane = paneId ? layout.panes[paneId] : undefined;
    const valid =
      !(target.groupId !== undefined && !group) &&
      !(target.paneId !== undefined && (!pane || !group?.panes.includes(target.paneId)));
    const commandContext = {
      ...(group ? { groupId: group.id } : {}),
      ...(pane ? { paneId: pane.id } : {}),
    };
    return { layout, group, pane, valid, commandContext };
  }
  function canExecuteAction(action: CommandId, context?: ActionContext): boolean {
    if (dependencies.disposed()) return false;
    const { layout, group, pane, valid, commandContext } = resolve(context);
    if (!valid) return false;
    if (!isWorkspaceAction(action)) {
      const entry = dependencies.registry.getCommand(action);
      if (!entry || entry.controller.signal.aborted) return false;
      try {
        const input: CommandContext = Object.freeze({
          ...commandContext,
          signal: entry.controller.signal,
        });
        return (entry.definition.enabled?.(input) ?? true) && !entry.controller.signal.aborted;
      } catch (error) {
        dependencies.report(error);
        return false;
      }
    }
    if (action === 'restoreClosedTab') return options.store.canRestoreClosedTab();
    if (!group) return false;
    const allowed = (cap: 'split' | 'addTab' | 'maximize' | 'close') =>
      options.store.canNode(group.id, cap);
    switch (action) {
      case 'maximize':
        return layout.maximized === group.id || allowed('maximize');
      case 'addTab':
        return !!options.tabs?.list().length && allowed('addTab');
      case 'splitLeft':
      case 'splitRight':
      case 'splitUp':
      case 'splitDown':
        return (!group.panes.length || !!options.tabs?.list().length) && allowed('split');
      case 'closeActiveTab':
        return !!pane && options.store.can(pane.id, 'close');
      case 'closePane':
        return !!group.panes.length && allowed('close');
      case 'closeEmptyPane':
        return !group.panes.length && group.id !== layout.root.id && allowed('close');
      case 'popout':
        return options.popouts !== false && !!pane && options.store.can(pane.id, 'popout');
      case 'joinSiblingRegion': {
        const parent = findParent(layout.root, group.id);
        return !!parent && options.store.canNode(parent.id, 'join');
      }
      default:
        return true;
    }
  }
  async function executeAction(action: CommandId, context?: ActionContext): Promise<boolean> {
    try {
      if (!canExecuteAction(action, context)) return false;
      const { layout, group, pane, commandContext } = resolve(context);
      if (!isWorkspaceAction(action)) {
        const entry = dependencies.registry.getCommand(action);
        if (!entry || entry.controller.signal.aborted) return false;
        const result = await entry.definition.execute(
          Object.freeze({ ...commandContext, signal: entry.controller.signal }),
        );
        return result !== false && !entry.controller.signal.aborted;
      }
      switch (action) {
        case 'restoreClosedTab':
          options.store.restoreClosedTab();
          break;
        case 'maximize':
          options.store.maximize(layout.maximized === group!.id ? null : group!.id, {
            source: 'user',
          });
          break;
        case 'addTab':
        case 'splitLeft':
        case 'splitRight':
        case 'splitUp':
        case 'splitDown':
          dependencies.create(action, group!, pane);
          break;
        case 'closeActiveTab':
          return await dependencies.close(pane!.id);
        case 'closePane':
          return await dependencies.close(group!.id, 'group');
        case 'closeEmptyPane':
          options.store.removeEmptyGroup(group!.id, { source: 'user' });
          break;
        case 'popout':
          return await dependencies.popout(pane!.id);
        case 'joinSiblingRegion':
          options.store.join(group!.id, { source: 'user' });
          break;
        case 'tabOrientationDefault':
          options.store.setTabPlacement(group!.id, undefined);
          break;
        case 'tabOrientationHorizontal':
          options.store.setTabPlacement(group!.id, 'top');
          break;
        case 'tabOrientationVertical':
          options.store.setTabPlacement(group!.id, 'left');
          break;
        case 'tabDisplayDefault':
          options.store.setTabDisplay(group!.id, undefined);
          break;
        case 'tabDisplayAutomatic':
          options.store.setTabDisplay(group!.id, 'automatic');
          break;
        case 'tabDisplayCompact':
          options.store.setTabDisplay(group!.id, 'compact');
          break;
      }
      return true;
    } catch (error) {
      dependencies.report(error);
      return false;
    }
  }
  return {
    canExecuteAction,
    executeAction,
    getShortcuts: () => dependencies.registry.getShortcuts(),
  };
}
