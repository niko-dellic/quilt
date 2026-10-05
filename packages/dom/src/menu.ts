import { message } from './messages.js';
import { actionIcon } from './action-icons.js';
import type { ActionIcon } from './action-icons.js';
import { fillTabPicker } from './picker.js';
import { findNode, findParent, groups, paneIds } from 'quilt-core';
import type { Group, Pane } from 'quilt-core';
import type { ResolvedLayoutOptions, WorkspaceAction, ActionContext } from './types.js';
import type { createActions } from './actions.js';
import { formatShortcut, ariaShortcut } from './shortcut-registration.js';
import { el, Scope } from './lifetime.js';
export function createPaneMenu(
  root: HTMLElement,
  options: ResolvedLayoutOptions,
  refresh: () => void,
  report: (e: unknown) => void,
  actions: ReturnType<typeof createActions>,
) {
  const doc = root.ownerDocument,
    win = doc.defaultView!;
  const pointerScope = new Scope();
  let pointerPosition: { x: number; y: number } | undefined;
  pointerScope.listen(
    doc,
    'pointermove',
    (event) => {
      const pointer = event as PointerEvent;
      pointerPosition = { x: pointer.clientX, y: pointer.clientY };
    },
    { capture: true, passive: true },
  );
  let current: Scope | undefined;
  let shortcutTarget:
    { dialog: HTMLDialogElement; context: ActionContext; close(): void } | undefined;
  let refreshShortcuts = () => {};
  const persistentPickers = new Map<string, Scope>();
  const act = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      report(error);
    }
  };
  function button(text: string, label: string, action: () => void) {
    const b = el(doc, 'button', 'layouts-button', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.onclick = () => act(action);
    return b;
  }
  function open(
    anchor: HTMLElement,
    pane: Pane | undefined,
    group: Group,
    direction?: 'left' | 'right' | 'top' | 'bottom',
    ratio = 0.5,
    groupActions = false,
    addTab = false,
  ) {
    current?.dispose();
    const latestGroup = findNode(options.store.getSnapshot().root, group.id);
    if (latestGroup?.kind !== 'group') return;
    group = latestGroup;
    const local = new Scope();
    current = local;
    const dialog = el(doc, 'dialog', 'layouts-menu');
    dialog.tabIndex = -1;
    dialog.autofocus = true;
    dialog.setAttribute(
      'aria-label',
      pane && !groupActions
        ? message(options, '{title} actions', { title: pane.title })
        : message(options, 'Empty pane actions'),
    );
    local.add(() => dialog.remove());
    const context = {
      groupId: group.id,
      ...(pane && group.panes.includes(pane.id) ? { paneId: pane.id } : {}),
    };
    const hints: { element: HTMLButtonElement; action: WorkspaceAction }[] = [];
    const bindAction = (element: HTMLButtonElement, action: WorkspaceAction) => {
      hints.push({ element, action });
      element.disabled = !actions.canExecuteAction(action, context);
      element.onclick = () => {
        local.dispose();
        void actions.executeAction(action, context);
      };
    };
    const add = (
      icon: ActionIcon,
      label: string,
      enabled: boolean,
      fn: (() => void) | WorkspaceAction,
      target: HTMLElement = dialog,
    ) => {
      const b = button(label, label, () => {
        local.dispose();
        if (typeof fn === 'function') act(fn);
      });
      const glyph = el(doc, 'span', 'layouts-tab-icon');
      glyph.setAttribute('aria-hidden', 'true');
      act(() => glyph.append(actionIcon(doc, icon, options)));
      b.replaceChildren(glyph, el(doc, 'span', '', label.replace(/^\+ /, '')));
      b.disabled = !enabled;
      if (typeof fn === 'string') bindAction(b, fn);
      if (target !== dialog) b.setAttribute('role', 'menuitem');
      target.append(b);
      return b;
    };
    const allowed = (cap: 'split' | 'join' | 'addTab') => options.store.canNode(group.id, cap);
    const available = Boolean(options.tabs?.list().length);
    const create = (axis?: 'horizontal' | 'vertical', before = false) => {
      if (!axis && !pane && !options.tabs) return;
      let destination = group;
      if (axis && (options.tabs || !pane)) {
        const id = options.store.split(group.id, axis, null, { source: 'user', before, ratio });
        destination = findNode(options.store.getSnapshot().root, id) as Group;
        refresh();
        if (!options.tabs) return;
      }
      if (!options.store.canNode(destination.id, 'addTab')) return;
      const commit = (fresh: Pane) => options.store.add(fresh, destination.id, { source: 'user' });
      if (options.tabs) {
        if ((axis || !group.panes.length) && options.store.getAutoCollapse() === 'disabled') {
          if (persistentPickers.has(destination.id)) {
            const region = Array.from(root.querySelectorAll<HTMLElement>('[data-node-id]')).find(
              (element) => element.dataset.nodeId === destination.id,
            );
            region?.querySelector<HTMLInputElement>('.layouts-picker-search')?.focus();
            return;
          }
          const region = Array.from(root.querySelectorAll<HTMLElement>('[data-node-id]')).find(
            (element) => element.dataset.nodeId === destination.id,
          );
          if (!region) return;
          const pickerScope = new Scope();
          persistentPickers.set(destination.id, pickerScope);
          const picker = el(doc, 'div', 'layouts-menu layouts-picker layouts-picker-persistent');
          picker.setAttribute('role', 'dialog');
          region.append(picker);
          pickerScope.listen(
            doc,
            'pointerdown',
            (event) => {
              if (!event.composedPath().includes(region)) pickerScope.dispose();
            },
            { capture: true },
          );
          pickerScope.add(() => {
            picker.remove();
            persistentPickers.delete(destination.id);
          });
          pickerScope.add(
            options.store.subscribe(() => {
              const group = findNode(options.store.getSnapshot().root, destination.id);
              if (group?.kind !== 'group' || group.panes.length) pickerScope.dispose();
            }),
          );
          fillTabPicker(picker, pickerScope, options, pane, destination, commit, report, true);
          return;
        }
        const pickerScope = new Scope();
        current = pickerScope;
        const picker = el(doc, 'dialog', 'layouts-menu layouts-picker');
        if (axis)
          pickerScope.add(() => {
            if (options.store.getAutoCollapse() !== 'disabled')
              options.store.removeEmptyGroup(destination.id);
          });
        pickerScope.add(() => picker.remove());
        pickerScope.listen(picker, 'close', () => pickerScope.dispose());
        root.append(picker);
        pickerScope.listen(picker, 'click', (event) => {
          const e = event as MouseEvent;
          const bounds = picker.getBoundingClientRect();
          if (
            e.target === picker &&
            (e.clientX < bounds.left ||
              e.clientX > bounds.right ||
              e.clientY < bounds.top ||
              e.clientY > bounds.bottom)
          )
            pickerScope.dispose();
        });
        picker.showModal();
        fillTabPicker(picker, pickerScope, options, pane, destination, commit, report);
        const region = Array.from(root.querySelectorAll<HTMLElement>('[data-node-id]')).find(
          (element) => element.dataset.nodeId === destination.id,
        );
        if (region) {
          const position = () => {
            const bounds = region.getBoundingClientRect();
            picker.style.width = `${Math.max(0, Math.min(340, bounds.width - 16))}px`;
            picker.style.maxHeight = `${Math.max(0, bounds.height - 16)}px`;
            picker.style.left = `${bounds.left + (bounds.width - picker.offsetWidth) / 2}px`;
            picker.style.top = `${bounds.top + (bounds.height - picker.offsetHeight) / 2}px`;
          };
          position();
          const observer = new ResizeObserver(position);
          observer.observe(region);
          observer.observe(picker);
          pickerScope.add(() => observer.disconnect());
          pickerScope.listen(win, 'resize', position);
          pickerScope.add(
            options.store.subscribe(() => {
              if (!findNode(options.store.getSnapshot().root, destination.id))
                pickerScope.dispose();
            }),
          );
        }
      }
    };
    if (addTab || (!direction && !group.panes.length && !groupActions)) {
      local.dispose();
      create();
      return;
    }
    if (direction) {
      local.dispose();
      create(
        direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical',
        direction === 'left' || direction === 'top',
      );
      return;
    }
    add('add-tab', message(options, '+ Add tab'), available && allowed('addTab'), 'addTab');
    const canCreate = !group.panes.length || available;
    const flyouts: { trigger: HTMLElement; flyout: HTMLElement }[] = [];
    let positionMenus = () => {};
    function submenu(label: string, icon: ActionIcon, enabled = true) {
      const container = el(doc, 'div', 'layouts-submenu');
      const trigger = button(`${label} ▸`, label, () => setOpen(true));
      const glyph = el(doc, 'span', 'layouts-tab-icon');
      glyph.setAttribute('aria-hidden', 'true');
      glyph.append(actionIcon(doc, icon, options));
      trigger.prepend(glyph);
      trigger.disabled = !enabled;
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');
      const flyout = el(doc, 'div', 'layouts-submenu-content');
      flyout.hidden = true;
      flyout.setAttribute('role', 'menu');
      flyout.setAttribute('aria-label', label);
      flyouts.push({ trigger, flyout });
      let keyboardClosed = false;
      let closedAt: { x: number; y: number } | undefined;
      let closeTimer: number | undefined;
      const cancelClose = () => {
        win.clearTimeout(closeTimer);
        closeTimer = undefined;
      };
      local.add(cancelClose);
      const setOpen = (open: boolean) => {
        cancelClose();
        if (open) {
          for (const other of flyouts) {
            other.flyout.hidden = true;
            other.trigger.setAttribute('aria-expanded', 'false');
          }
        }
        flyout.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        if (open) positionMenus();
      };
      local.listen(container, 'pointerenter', () => {
        if (!trigger.disabled && !keyboardClosed) setOpen(true);
      });
      // Hiding a flyout can retarget a stationary pointer in WebKit. Only actual
      // pointer movement should undo an explicit keyboard close.
      local.listen(doc, 'pointermove', (event) => {
        const pointer = event as PointerEvent;
        const moved = !closedAt || pointer.clientX !== closedAt.x || pointer.clientY !== closedAt.y;
        if (keyboardClosed && moved) {
          keyboardClosed = false;
          if (!trigger.disabled && container.contains(pointer.target as Node)) setOpen(true);
        }
      });
      // Allow the pointer to cross the dialog padding or move diagonally into the flyout.
      local.listen(container, 'pointerleave', () => {
        cancelClose();
        closeTimer = win.setTimeout(() => setOpen(false), 300);
      });
      local.listen(trigger, 'keydown', (event) => {
        if ((event as KeyboardEvent).key === 'ArrowRight') {
          event.preventDefault();
          setOpen(true);
          (flyout.firstElementChild as HTMLElement)?.focus();
        }
      });
      local.listen(flyout, 'keydown', (event) => {
        if ((event as KeyboardEvent).key === 'ArrowLeft') {
          event.preventDefault();
          keyboardClosed = true;
          closedAt = pointerPosition;
          setOpen(false);
          trigger.focus();
        }
      });
      container.append(trigger, flyout);
      dialog.append(container);
      return flyout;
    }
    const flyout = submenu(message(options, 'Split'), 'split-right', canCreate && allowed('split'));
    for (const [label, axis, action] of [
      [message(options, 'Split left'), 'horizontal', 'splitLeft'],
      [message(options, 'Split right'), 'horizontal', 'splitRight'],
      [message(options, 'Split up'), 'vertical', 'splitUp'],
      [message(options, 'Split down'), 'vertical', 'splitDown'],
    ] as const) {
      const option = button(label, label, () => {});
      bindAction(option, action);
      const icon = el(doc, 'span', 'layouts-tab-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.append(actionIcon(doc, axis === 'horizontal' ? 'split-right' : 'split-below', options));
      option.prepend(icon);
      option.setAttribute('role', 'menuitem');
      flyout.append(option);
    }
    const joinParent = findParent(options.store.getSnapshot().root, group.id);
    const join = add(
      'join',
      message(options, 'Join sibling region'),
      Boolean(joinParent) && paneIds(joinParent!).every((id) => options.store.can(id, 'join')),
      'joinSiblingRegion',
    );
    let preview: Scope | undefined;
    const clearPreview = () => {
      preview?.dispose();
      preview = undefined;
    };
    local.add(clearPreview);
    const showPreview = () => {
      clearPreview();
      const layout = options.store.getSnapshot();
      const parent = findParent(layout.root, group.id);
      if (join.disabled || !parent) return;
      const scope = new Scope();
      preview = scope;
      const overlay = el(doc, 'div', 'layouts-corner-overlay');
      overlay.setAttribute('aria-hidden', 'true');
      root.append(overlay);
      scope.add(() => overlay.remove());
      const targetTitle =
        layout.panes[group.active ?? '']?.title ?? message(options, 'This region');
      const regions = groups(parent).map((region) => ({
        region,
        element: Array.from(root.querySelectorAll<HTMLElement>('[data-node-id]')).find(
          (element) => element.dataset.nodeId === region.id && element.closest('.layouts') === root,
        ),
      }));
      const position = () => {
        overlay.replaceChildren();
        for (const { region, element } of regions) {
          if (!element || !element.getClientRects().length) continue;
          const rect = element.getBoundingClientRect();
          const box = el(doc, 'div', 'layouts-corner-preview');
          box.dataset.cornerPreview = region.id === group.id ? 'join-target' : 'join-source';
          Object.assign(box.style, {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
          box.append(
            el(
              doc,
              'span',
              'layouts-corner-label',
              region.id === group.id
                ? message(options, '{target} keeps all tabs', { target: targetTitle })
                : message(options, 'Joins {target}', { target: targetTitle }),
            ),
          );
          overlay.append(box);
        }
      };
      position();
      const observer = new win.ResizeObserver(position);
      for (const { element } of regions) if (element) observer.observe(element);
      scope.add(() => observer.disconnect());
      scope.listen(win, 'resize', position);
      scope.listen(doc, 'scroll', position, { capture: true });
      scope.add(options.store.subscribe(clearPreview));
    };
    local.listen(join, 'pointerenter', showPreview);
    local.listen(join, 'pointerleave', clearPreview);
    local.listen(join, 'focus', showPreview);
    local.listen(join, 'blur', clearPreview);
    add(
      options.store.getSnapshot().maximized === group.id ? 'restore' : 'maximize',
      options.store.getSnapshot().maximized === group.id
        ? message(options, 'Restore region')
        : message(options, 'Maximize region'),
      true,
      'maximize',
    );
    if (group.panes.length && pane && options.popouts !== false) {
      add(
        'popout',
        message(options, 'Open in window'),
        options.store.can(pane.id, 'popout'),
        'popout',
      );
    }
    const orientation = submenu(message(options, 'Tab orientation'), 'tab-orientation');
    for (const [value, label] of [
      [undefined, message(options, 'Workspace default')],
      ['top', message(options, 'Horizontal')],
      ['left', message(options, 'Vertical')],
    ] as const) {
      const selected = group.tabPlacement === value;
      const option = button(label, label, () => {});
      bindAction(
        option,
        value === 'top'
          ? 'tabOrientationHorizontal'
          : value === 'left'
            ? 'tabOrientationVertical'
            : 'tabOrientationDefault',
      );
      option.setAttribute('role', 'menuitemradio');
      option.setAttribute('aria-checked', String(selected));
      const mark = el(doc, 'span', 'layouts-tab-icon', selected ? '✓' : '');
      mark.setAttribute('aria-hidden', 'true');
      option.prepend(mark);
      orientation.append(option);
    }
    const display = submenu(message(options, 'Tab display'), 'tab-orientation');
    for (const [value, label] of [
      [undefined, message(options, 'Workspace default')],
      ['automatic', message(options, 'Automatic')],
      ['compact', message(options, 'Compact')],
    ] as const) {
      const selected = group.tabDisplay === value;
      const option = button(label, label, () => {});
      bindAction(
        option,
        value === 'automatic'
          ? 'tabDisplayAutomatic'
          : value === 'compact'
            ? 'tabDisplayCompact'
            : 'tabDisplayDefault',
      );
      option.setAttribute('role', 'menuitemradio');
      option.setAttribute('aria-checked', String(selected));
      const mark = el(doc, 'span', 'layouts-tab-icon', selected ? '✓' : '');
      mark.setAttribute('aria-hidden', 'true');
      option.prepend(mark);
      display.append(option);
    }
    if (group.panes.length && pane) {
      const close = submenu(message(options, 'Close'), 'close');
      add(
        'close',
        message(options, 'Close active tab'),
        options.store.can(pane.id, 'close'),
        'closeActiveTab',
        close,
      );
      add(
        'close',
        message(options, 'Close pane'),
        group.panes.every((id) => options.store.can(id, 'close')),
        'closePane',
        close,
      );
    } else {
      add(
        'close',
        message(options, 'Close empty pane'),
        options.store.getSnapshot().root.id !== group.id,
        'closeEmptyPane',
      );
    }
    add(
      'restore',
      message(options, 'Restore closed tab'),
      options.store.canRestoreClosedTab(),
      'restoreClosedTab',
    );
    add('cancel', message(options, 'Cancel'), true, () => {});
    root.append(dialog);
    // Measure after opening: theme density, labels, and available actions change the size.
    // Fixed flyouts escape the scrolling dialog while retaining its modal focus scope.
    positionMenus = () => {
      const viewport = win.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const width = Math.max(0, (viewport?.width ?? doc.documentElement.clientWidth) - 16);
      const height = Math.max(0, (viewport?.height ?? doc.documentElement.clientHeight) - 16);
      const fit = (element: HTMLElement) => {
        element.style.maxWidth = `${width}px`;
        element.style.maxHeight = `${height}px`;
      };
      const place = (element: HTMLElement, x: number, y: number) => {
        const bounds = element.getBoundingClientRect();
        element.style.left = `${Math.max(left, Math.min(x, left + width - bounds.width))}px`;
        element.style.top = `${Math.max(top, Math.min(y, top + height - bounds.height))}px`;
      };
      fit(dialog);
      const rect = anchor.getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      const below = rect.bottom + 4;
      const above = rect.top - bounds.height - 4;
      place(
        dialog,
        rect.right - bounds.width,
        below + bounds.height <= top + height || above < top ? below : above,
      );
      for (const { trigger, flyout } of flyouts) {
        if (flyout.hidden) continue;
        fit(flyout);
        const row = trigger.getBoundingClientRect();
        const menu = dialog.getBoundingClientRect();
        const size = flyout.getBoundingClientRect();
        const x =
          menu.right - 1 + size.width <= left + width ? menu.right - 1 : menu.left - size.width + 1;
        place(flyout, x, row.top);
      }
    };
    local.listen(dialog, 'close', () => local.dispose());
    local.listen(dialog, 'click', (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        const e = event as MouseEvent;
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          local.dispose();
      }
    });
    const updateHints = () => {
      const registrations = actions.getShortcuts();
      for (const { element, action } of hints) {
        element.querySelector('.layouts-shortcut')?.remove();
        element.removeAttribute('aria-keyshortcuts');
        element.disabled = !actions.canExecuteAction(action, context);
        const label = element.getAttribute('aria-label') ?? '';
        const registration = registrations.find((entry) => entry.action === action);
        element.removeAttribute('title');
        if (!registration) continue;
        const labels = registration.bindings.map((binding) => {
          try {
            return options.formatShortcut?.(binding) ?? formatShortcut(binding);
          } catch (error) {
            report(error);
            return formatShortcut(binding);
          }
        });
        const badge = el(doc, 'kbd', 'layouts-shortcut', labels[0]);
        badge.setAttribute('aria-hidden', 'true');
        element.append(badge);
        element.title = `${label} (${labels.join(' / ')})`;
        if (!element.disabled)
          element.setAttribute(
            'aria-keyshortcuts',
            registration.bindings.map(ariaShortcut).join(' '),
          );
      }
      positionMenus();
    };
    refreshShortcuts = updateHints;
    local.add(() => {
      if (refreshShortcuts === updateHints) refreshShortcuts = () => {};
    });
    const target = { dialog, context, close: () => local.dispose() };
    shortcutTarget = target;
    local.add(() => {
      if (shortcutTarget === target) shortcutTarget = undefined;
    });
    dialog.showModal();
    updateHints();
    const observer = new win.ResizeObserver(positionMenus);
    observer.observe(dialog);
    observer.observe(anchor);
    for (const { flyout } of flyouts) observer.observe(flyout);
    local.add(() => observer.disconnect());
    local.listen(win, 'resize', positionMenus);
    local.listen(doc, 'scroll', positionMenus, { capture: true });
    if (win.visualViewport) {
      local.listen(win.visualViewport, 'resize', positionMenus);
      local.listen(win.visualViewport, 'scroll', positionMenus);
    }
    dialog.focus({ preventScroll: true });
  }
  return {
    getShortcutTarget: () => shortcutTarget,
    refreshShortcuts: () => refreshShortcuts(),
    open,
    addTab(anchor: HTMLElement, group: Group) {
      const layout = options.store.getSnapshot();
      open(
        anchor,
        group.active ? layout.panes[group.active] : undefined,
        group,
        undefined,
        0.5,
        false,
        true,
      );
    },
    openEmpty(anchor: HTMLElement, group: Group) {
      const source = Object.values(options.store.getSnapshot().panes).find(
        (pane) => pane.header !== false,
      );
      open(anchor, source, group, undefined, 0.5, true);
    },
    close() {
      current?.dispose();
      for (const picker of persistentPickers.values()) picker.dispose();
    },
    dispose() {
      pointerScope.dispose();
      current?.dispose();
      for (const picker of persistentPickers.values()) picker.dispose();
    },
  };
}
