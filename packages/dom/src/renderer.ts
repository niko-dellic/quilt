import { chromeMinimum } from './chrome-size.js';
import { closeRequests } from './close.js';
import { dockLayout, parseWorkspace } from './workspace.js';
import { validateTheme, themePixels } from './theme.js';
import { message } from './messages.js';
import { isolatedResize } from './resize.js';
import { chromeIcon } from './chrome-icons.js';
import { bindTabBar, validateTabBar } from './tab-bar.js';
import { bindCorners } from './corners.js';
import { applyTheme } from './theme.js';
import { fillTabs } from './tabs.js';
import { bindShortcuts } from './shortcuts.js';
import {
  LayoutStore,
  createLayout,
  allocate,
  bounds as modelBounds,
  DIVIDER,
  findNode,
  groups,
  paneIds,
} from 'quilt-core';
import type { Group, Layout, Node, Pane } from 'quilt-core';
import type { LayoutOptions, ResolvedLayoutOptions, MountedLayout, TabBarStyle } from './types.js';
import { Scope, el, syncChildren } from './lifetime.js';
import { mountPane } from './panes.js';
import type { MountedPane } from './panes.js';
import { Windows } from './windows.js';
import { createPaneMenu } from './menu.js';
interface Region {
  element: HTMLElement;
  kind: Node['kind'];
  scope: Scope;
  header?: HTMLElement;
  body?: HTMLElement;
  divider?: HTMLElement;
  signature?: string;
  updateTabBar?: () => void;
  tabStyle?: () => TabBarStyle;
}
let nextMount = 0;
export function mountLayout<State = unknown>(
  host: HTMLElement,
  input: LayoutOptions<State>,
): MountedLayout<State> {
  if ('store' in input)
    throw new Error('Quilt owns its store; pass initialLayout or initialWorkspace');
  if (input.initialLayout !== undefined && input.initialWorkspace !== undefined)
    throw new Error('initialLayout and initialWorkspace are mutually exclusive');
  if (input.registry && (input.renderers || input.tabs))
    throw new Error('registry cannot be combined with renderers or tabs');
  const preset =
    input.initialWorkspace === undefined ? undefined : parseWorkspace(input.initialWorkspace);
  const theme = preset?.theme ?? input.theme ?? {};
  const tabBar = preset?.tabBar ?? input.tabBar ?? {};
  validateTheme(theme);
  validateTabBar(tabBar);
  const store = new LayoutStore(
    dockLayout(preset?.layout ?? input.initialLayout ?? createLayout()),
    {
      autoCollapse: preset?.autoCollapse ?? 'disabled',
    },
  );
  // The initialization scope rolls back even if setup fails before returning a handle.
  const scope = new Scope();
  scope.add(() => store.dispose());
  try {
    return mountLayoutInternal(
      host,
      { ...input, store, theme, tabBar } as unknown as ResolvedLayoutOptions,
      scope,
    ) as MountedLayout<State>;
  } catch (error) {
    scope.dispose();
    throw error;
  }
}

function mountLayoutInternal(
  host: HTMLElement,
  input: ResolvedLayoutOptions,
  scope: Scope,
): MountedLayout {
  const options = { ...input };
  const configure = () => {
    if (options.registry) {
      options.tabs = options.registry.tabs;
      options.renderers = Object.fromEntries(
        options.registry.list().map((entry) => [entry.type, entry.view]),
      );
    }
  };
  if (input.registry && (input.renderers || input.tabs))
    throw new Error('registry cannot be combined with renderers or tabs');
  configure();
  validateTheme(options.theme ?? {});
  validateTabBar(options.tabBar ?? {});
  let tabBar = structuredClone(options.tabBar ?? {});
  const prefix = `layouts-${++nextMount}`;
  const doc = host.ownerDocument,
    win = doc.defaultView;
  if (!win) throw new Error('Layout host must belong to a live document');
  const regions = new Map<string, Region>(),
    panes = new Map<string, MountedPane>();
  const root = el(doc, 'div', 'layouts');
  applyTheme(root, options.theme ?? {});
  root.setAttribute('aria-label', message(options, 'Pane workspace'));
  const stage = el(doc, 'div', 'layouts-stage');
  const status = el(doc, 'div', 'layouts-status');
  status.setAttribute('role', 'status');
  root.append(stage, status);
  host.append(root);
  scope.add(() => root.remove());
  let disposed = false,
    rendering = false,
    again = false,
    dragScope: Scope | undefined;
  let dragId: string | undefined;
  const error = (e: unknown) => {
    status.textContent = e instanceof Error ? e.message : String(e);
    try {
      options.onError?.(e);
    } catch {
      /* A consumer reporter must not prevent cleanup. */
    }
  };
  const act = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      error(e);
    }
  };
  const closeScope = new Scope();
  scope.add(() => closeScope.dispose());
  const requestClose = closeRequests(root, options, closeScope, error);
  const windows = new Windows(doc, options, error, root);
  scope.add(() => windows.dispose());
  scope.add(() => {
    for (const pane of panes.values()) pane.dispose();
    panes.clear();
    for (const region of regions.values()) region.scope.dispose();
    regions.clear();
  });
  const menu = createPaneMenu(root, options, windows, render, error, requestClose);
  scope.add(() => menu.dispose());
  scope.add(() => dragScope?.dispose());
  bindShortcuts(root, options, scope, act, (group) => {
    const region = regions.get(group.id);
    if (region) menu.addTab(region.header ?? region.element, group);
  });
  const renderOptions = { ...options, onError: error };
  function button(text: string, title: string, action: () => void) {
    const b = el(doc, 'button', 'layouts-button', text);
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.onclick = () => act(action);
    return b;
  }
  function region(node: Node): Region {
    const existing = regions.get(node.id);
    if (existing?.kind === node.kind) return existing;
    if (existing) {
      existing.scope.dispose();
      existing.element.remove();
      regions.delete(node.id);
    }
    const r: Region = {
      kind: node.kind,
      element: el(doc, 'section', `layouts-node layouts-${node.kind}`),
      scope: new Scope(),
    };
    r.element.dataset.nodeId = node.id;
    if (node.kind === 'group') {
      r.header = el(doc, 'header', 'layouts-header');
      r.body = el(doc, 'div', 'layouts-body');
      r.element.append(r.header, r.body);
      r.tabStyle = () => {
        const current = findNode(options.store.getSnapshot().root, node.id);
        return {
          ...tabBar,
          ...(tabBar.regions?.[node.id] ?? {}),
          ...(current?.kind === 'group' && current.tabDisplay
            ? { display: current.tabDisplay }
            : {}),
          ...(current?.kind === 'group' && current.tabPlacement
            ? { placement: current.tabPlacement }
            : {}),
        };
      };
      r.updateTabBar = bindTabBar(
        r.element,
        r.header,
        root,
        r.scope,
        r.tabStyle,
        () => options.messages ?? {},
      );
      bindCorners(
        r.element,
        node.id,
        options,
        r.scope,
        (pane, group, direction, ratio) => menu.open(r.header!, pane, group, direction, ratio),
        error,
        bounds,
      );
      r.element.setAttribute('aria-label', message(options, 'Pane region'));
      r.scope.listen(r.element, 'dragover', (event) => {
        if (!dragId) return;
        const e = event as DragEvent;
        const current = findNode(options.store.getSnapshot().root, node.id);
        if (current?.kind !== 'group') return;
        const position = dropPosition(e, r.element);
        if (
          !options.store.can(dragId, 'move') ||
          !current.panes.every(
            (id) =>
              options.store.can(id, 'move') &&
              (position === 'tab' || options.store.can(id, 'split')),
          )
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        r.element.dataset.drop = position;
      });
      r.scope.listen(r.element, 'dragleave', (event) => {
        if (!r.element.contains((event as DragEvent).relatedTarget as globalThis.Node | null))
          delete r.element.dataset.drop;
      });
      r.scope.listen(r.element, 'drop', (event) => {
        const e = event as DragEvent;
        if (!dragId) return;
        e.preventDefault();
        e.stopPropagation();
        const id = dragId;
        dragId = undefined;
        delete r.element.dataset.drop;
        act(() =>
          options.store.move(id, node.id, dropPosition(e, r.element), undefined, {
            source: 'user',
          }),
        );
      });
    } else {
      r.divider = el(doc, 'div', 'layouts-divider');
      r.divider.tabIndex = 0;
      r.divider.setAttribute('role', 'separator');
      r.divider.setAttribute('aria-label', message(options, 'Resize panes'));
      const start = (event: Event) => {
        const e = event as PointerEvent;
        if (e.button !== 0) return;
        const n = findNode(options.store.getSnapshot().root, node.id);
        if (n?.kind !== 'split' || !resizable(n, options.store.getSnapshot())) return;
        e.preventDefault();
        dragScope?.dispose();
        const drag = new Scope();
        dragScope = drag;
        const resize = isolatedResize(
          geometryLayout(),
          node.id,
          (child, axis) => {
            const rect = regions.get(child.id)!.element.getBoundingClientRect();
            return axis === 'horizontal' ? rect.width : rect.height;
          },
          bounds,
        );
        r.divider!.setPointerCapture(e.pointerId);
        root.classList.add('layouts-resizing');
        drag.add(() => {
          root.classList.remove('layouts-resizing');
          try {
            r.divider!.releasePointerCapture(e.pointerId);
          } catch {}
        });
        const set = (move: PointerEvent) => {
          const current = findNode(geometryLayout().root, node.id);
          if (current?.kind !== 'split') return;
          const rect = r.element.getBoundingClientRect();
          const available =
            (current.axis === 'horizontal' ? rect.width : rect.height) - (current.gap ?? DIVIDER);
          if (available > 0)
            act(() =>
              options.store.resizeMany(
                resize.ratios(
                  Math.max(
                    0.001,
                    Math.min(
                      0.999,
                      (current.axis === 'horizontal'
                        ? move.clientX - rect.left
                        : move.clientY - rect.top) / available,
                    ),
                  ),
                ),
                { source: 'user' },
              ),
            );
        };
        drag.listen(r.divider!, 'pointermove', (move) => set(move as PointerEvent));
        drag.listen(r.divider!, 'pointerup', () => drag.dispose());
        drag.listen(r.divider!, 'pointercancel', () => drag.dispose());
        drag.listen(doc, 'keydown', (key) => {
          if ((key as KeyboardEvent).key === 'Escape') {
            act(() => options.store.resizeMany(resize.original));
            drag.dispose();
          }
        });
      };
      r.scope.listen(r.divider, 'pointerdown', start);
      r.scope.listen(r.divider, 'keydown', (event) => {
        const e = event as KeyboardEvent;
        const n = findNode(options.store.getSnapshot().root, node.id);
        if (n?.kind !== 'split' || !resizable(n, options.store.getSnapshot())) return;
        const keys =
          n.axis === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
        if (keys.includes(e.key)) {
          e.preventDefault();
          const resize = isolatedResize(
            geometryLayout(),
            node.id,
            (child, axis) => {
              const rect = regions.get(child.id)!.element.getBoundingClientRect();
              return axis === 'horizontal' ? rect.width : rect.height;
            },
            bounds,
          );
          act(() =>
            options.store.resizeMany(
              resize.ratios(
                Math.max(
                  0.001,
                  Math.min(
                    0.999,
                    n.ratio + (e.key === keys[0] ? -1 : 1) * (e.shiftKey ? 0.1 : 0.02),
                  ),
                ),
              ),
              { source: 'user' },
            ),
          );
        }
      });
    }
    regions.set(node.id, r);
    return r;
  }
  function dropPosition(
    e: DragEvent,
    element: HTMLElement,
  ): 'tab' | 'left' | 'right' | 'top' | 'bottom' {
    const rect = element.getBoundingClientRect(),
      x = (e.clientX - rect.left) / rect.width,
      y = (e.clientY - rect.top) / rect.height;
    if (x < 0.22) return 'left';
    if (x > 0.78) return 'right';
    if (y < 0.22) return 'top';
    if (y > 0.78) return 'bottom';
    return 'tab';
  }
  function content(pane: Pane): MountedPane {
    const old = panes.get(pane.id),
      signature = JSON.stringify(pane);
    if (
      old &&
      old.renderer !==
        (Object.hasOwn(options.renderers ?? {}, pane.type)
          ? options.renderers?.[pane.type]
          : undefined)
    ) {
      old.dispose();
      panes.delete(pane.id);
      return content(pane);
    }
    if (old) {
      if (old.signature !== signature) {
        if (
          old.pane.type !== pane.type ||
          JSON.stringify(old.pane.params) !== JSON.stringify(pane.params)
        ) {
          old.dispose();
          panes.delete(pane.id);
        } else {
          old.pane = pane;
          old.signature = signature;
          try {
            old.view.update?.(pane);
          } catch (error) {
            old.failed = true;
            throw error;
          }
          return old;
        }
      } else return old;
    }
    try {
      const mounted = mountPane(doc, pane, 'main', renderOptions);
      panes.set(pane.id, mounted);
      return mounted;
    } catch (e) {
      error(e);
      const element = el(
        doc,
        'div',
        'layouts-pane layouts-placeholder',
        message(options, 'Could not mount {title}. Retry this pane.', { title: pane.title }),
      );
      element.dataset.paneId = pane.id;
      const mounted: MountedPane = {
        element,
        pane,
        signature,
        renderer: options.renderers?.[pane.type],
        failed: true,
        view: { dispose() {} },
        dispose() {
          element.remove();
        },
      };
      panes.set(pane.id, mounted);
      return mounted;
    }
  }
  function paintGroup(g: Group, r: Region, layout: Layout) {
    const definitions = g.panes.map((id) => layout.panes[id]!);
    const signature = JSON.stringify([
      definitions,
      g.active,
      layout.maximized,
      layout.root.id === g.id,
    ]);
    if (r.signature !== signature) {
      r.signature = signature;
      r.header!.replaceChildren();
      r.header!.hidden = definitions.length === 1 && definitions[0]!.header === false;
      const tabs = el(doc, 'div', 'layouts-tabs');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', message(options, 'Tabs in {id}', { id: g.id }));
      fillTabs(tabs, g, definitions, {
        options,
        requestClose,
        prefix,
        act,
        getDrag: () => dragId,
        setDrag: (id) => {
          dragId = id;
        },
        clearDrop: () => {
          for (const region of regions.values()) delete region.element.dataset.drop;
          for (const marker of root.querySelectorAll<HTMLElement>('[data-tab-drop]'))
            delete marker.dataset.tabDrop;
        },
        focusActive: () =>
          regions.get(g.id)?.header?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(),
      });
      r.header!.append(tabs);
      if (!definitions.length) {
        const close = button('', message(options, 'Close empty pane'), () =>
          options.store.removeEmptyGroup(g.id),
        );
        close.append(chromeIcon(doc, 'close'));
        close.disabled = layout.root.id === g.id;
        const settings = button('', message(options, 'Empty pane actions'), () =>
          menu.openEmpty(settings, g),
        );
        settings.append(chromeIcon(doc, 'more'));
        settings.setAttribute('aria-haspopup', 'dialog');
        settings.dataset.focusId = `menu-${g.id}`;
        r.header!.append(close, settings);
      }
      const active = g.active ? layout.panes[g.active] : undefined;
      if (active) {
        const more = button('', message(options, '{title} actions', { title: active.title }), () =>
          menu.open(more, active, g),
        );
        more.append(chromeIcon(doc, 'more'));
        more.dataset.focusId = `menu-${active.id}`;
        more.setAttribute('aria-haspopup', 'dialog');
        r.header!.append(more);
      }
    }
    r.updateTabBar?.();
    const bodies = definitions.map((pane) => {
      const p = content(pane);
      p.element.hidden = pane.id !== g.active;
      p.element.id = `${prefix}-panel-${pane.id}`;
      p.element.setAttribute('role', 'tabpanel');
      if (r.header!.hidden) {
        p.element.setAttribute('aria-label', pane.title);
        p.element.removeAttribute('aria-labelledby');
      } else {
        p.element.setAttribute('aria-labelledby', `${prefix}-tab-${pane.id}`);
        p.element.removeAttribute('aria-label');
      }
      return p.element;
    });
    if (!bodies.length) {
      let placeholder = r.body!.querySelector<HTMLButtonElement>('.layouts-empty');
      if (!placeholder) {
        placeholder = button('', message(options, 'Choose a tab'), () => {
          const current = options.store.getSnapshot();
          const source = Object.values(current.panes).find((pane) => pane.header !== false);
          const group = findNode(current.root, g.id);
          if (group?.kind === 'group' && !group.panes.length)
            menu.open(placeholder!, source, group);
        });
        placeholder.className = 'layouts-empty';
        placeholder.removeAttribute('title');
        placeholder.disabled = !options.tabs;
        placeholder.setAttribute('aria-haspopup', 'dialog');
        const lines = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        lines.setAttribute('viewBox', '0 0 100 100');
        lines.setAttribute('preserveAspectRatio', 'none');
        lines.setAttribute('aria-hidden', 'true');
        const path = doc.createElementNS(lines.namespaceURI, 'path');
        path.setAttribute('d', 'M0 0 L100 100 M100 0 L0 100');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        lines.append(path);
        placeholder.append(lines);
      }
      bodies.push(placeholder);
    }
    syncChildren(r.body!, bodies);
  }
  function tree(node: Node, layout: Layout, used: Set<string>): HTMLElement {
    used.add(node.id);
    const r = region(node);
    if (node.kind === 'group') paintGroup(node, r, layout);
    else {
      const a = tree(node.children[0], layout, used),
        b = tree(node.children[1], layout, used);
      syncChildren(r.element, [a, r.divider!, b]);
      r.divider!.setAttribute(
        'aria-orientation',
        node.axis === 'horizontal' ? 'vertical' : 'horizontal',
      );
      r.divider!.dataset.axis = node.axis;
      r.divider!.setAttribute('aria-valuenow', String(Math.round(node.ratio * 100)));
      r.divider!.setAttribute('aria-valuemin', '0');
      r.divider!.setAttribute('aria-valuemax', '100');
      r.divider!.setAttribute('aria-disabled', String(!resizable(node, layout)));
    }
    return r.element;
  }
  function geometry(
    node: Node,
    x: number,
    y: number,
    width: number,
    height: number,
    layout: Layout,
    shared: string[] = [],
  ) {
    const r = regions.get(node.id);
    if (!r) return;
    if (r.element.dataset.sharedEdges !== shared.join(' ')) {
      r.element.dataset.sharedEdges = shared.join(' ');
      r.updateTabBar?.();
    }
    const b = bounds(node, layout);
    width = Math.max(b.minWidth, Math.min(width, b.maxWidth));
    height = Math.max(b.minHeight, Math.min(height, b.maxHeight));
    Object.assign(r.element.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    if (node.kind === 'split') {
      const a = bounds(node.children[0], layout),
        b = bounds(node.children[1], layout),
        horizontal = node.axis === 'horizontal',
        gap = node.gap ?? DIVIDER;
      const [first, second] = allocate(
        horizontal ? width : height,
        node.ratio,
        horizontal ? a.minWidth : a.minHeight,
        horizontal ? a.maxWidth : a.maxHeight,
        horizontal ? b.minWidth : b.minHeight,
        horizontal ? b.maxWidth : b.maxHeight,
        gap,
      );
      const frozen = gap === 0 && !resizable(node, layout);
      const firstEdge = horizontal ? 'right' : 'bottom';
      const secondEdge = horizontal ? 'left' : 'top';
      geometry(
        node.children[0],
        0,
        0,
        horizontal ? first : width,
        horizontal ? height : first,
        layout,
        [...shared.filter((edge) => edge !== firstEdge), ...(frozen ? [firstEdge] : [])],
      );
      geometry(
        node.children[1],
        horizontal ? first + gap : 0,
        horizontal ? 0 : first + gap,
        horizontal ? second : width,
        horizontal ? height : second,
        layout,
        [...shared.filter((edge) => edge !== secondEdge), ...(frozen ? [secondEdge] : [])],
      );
      r.divider!.hidden = gap === 0;
      // Paint a shared edge without reserving space or adding a resize target.
      r.element.dataset.frozenBorder = gap === 0 && !resizable(node, layout) ? node.axis : '';
      r.element.style.setProperty('--layouts-frozen-boundary', `${first}px`);
      Object.assign(
        r.divider!.style,
        horizontal
          ? { left: `${first}px`, top: '0', width: `${gap}px`, height: `${height}px` }
          : { left: '0', top: `${first}px`, width: `${width}px`, height: `${gap}px` },
      );
    }
  }
  function resizable(node: Node, layout: Layout) {
    if (node.kind !== 'split' || !paneIds(node).every((id) => options.store.can(id, 'resize')))
      return false;
    return node.children.every((child) => {
      const b = bounds(child, layout);
      return node.axis === 'horizontal' ? b.minWidth < b.maxWidth : b.minHeight < b.maxHeight;
    });
  }
  const chromeSizes = new Map<string, { minWidth: number; minHeight: number }>();
  function bounds(node: Node, layout: Layout) {
    return modelBounds(node, layout, (group, constraints) => {
      const chrome = chromeSizes.get(group.id);
      if (!chrome) return constraints;
      const minWidth = Math.max(constraints.minWidth, chrome.minWidth);
      const minHeight = Math.max(constraints.minHeight, chrome.minHeight);
      return {
        minWidth,
        minHeight,
        maxWidth: Math.max(constraints.maxWidth, minWidth),
        maxHeight: Math.max(constraints.maxHeight, minHeight),
      };
    });
  }
  // Renderer-only gaps participate in bounds/allocation without modifying Layout JSON.
  function geometryLayout(): Layout {
    const layout = options.store.getSnapshot();
    chromeSizes.clear();
    for (const [id, region] of regions) {
      if (region.header && region.tabStyle && region.element.isConnected)
        chromeSizes.set(id, chromeMinimum(region.element, region.header, region.tabStyle()));
    }
    const pixels = (property: string, fallback: number) => themePixels(root, property, fallback);
    const width = pixels('--layouts-resize-handle-width', DIVIDER);
    const disabledWidth = pixels('--layouts-disabled-resize-handle-width', 0);
    const visit = (node: Node): Node =>
      node.kind === 'group'
        ? node
        : {
            ...node,
            gap: resizable(node, layout) ? (node.gap ?? width) : disabledWidth,
            children: [visit(node.children[0]), visit(node.children[1])],
          };
    return { ...layout, root: visit(layout.root) };
  }
  function measure() {
    const layout = geometryLayout();
    const node = layout.maximized ? findNode(layout.root, layout.maximized) : layout.root;
    if (!node) return;
    // Reparented maximized regions can temporarily overflow their old split.
    // Discard those stale scrollbars before allocating the restored layout.
    const overflow = stage.style.overflow;
    let width: number, height: number;
    try {
      stage.style.overflow = 'hidden';
      width = stage.clientWidth;
      height = stage.clientHeight;
      geometry(node, 0, 0, width, height, layout);
    } finally {
      stage.style.overflow = overflow;
    }
    // Minimum sizes may still require real scrollbars; account for their space.
    if (stage.clientWidth !== width || stage.clientHeight !== height)
      geometry(node, 0, 0, stage.clientWidth, stage.clientHeight, layout);
  }
  function render() {
    if (disposed) return;
    if (rendering) {
      again = true;
      return;
    }
    rendering = true;
    try {
      const focused = (doc.activeElement as HTMLElement | null)?.dataset.focusId;
      const layout = options.store.getSnapshot(),
        used = new Set<string>();
      const element = tree(layout.root, layout, used);
      // Maximizing reparents a region; pane views remain mounted.
      const visible = layout.maximized ? regions.get(layout.maximized)?.element : element;
      if (visible) syncChildren(stage, [visible]);
      for (const [id, r] of regions)
        if (!used.has(id)) {
          r.scope.dispose();
          r.element.remove();
          regions.delete(id);
        }
      const docked = new Set(groups(layout.root).flatMap((g) => g.panes));
      for (const [id, p] of panes)
        if (!docked.has(id)) {
          p.dispose();
          panes.delete(id);
        }
      measure();
      if (focused && doc.activeElement === doc.body)
        Array.from(root.querySelectorAll<HTMLElement>('[data-focus-id]'))
          .find((n) => n.dataset.focusId === focused)
          ?.focus();
    } catch (e) {
      error(e);
    } finally {
      rendering = false;
      if (again) {
        again = false;
        render();
      }
    }
  }
  scope.add(
    options.store.subscribe((event) => {
      if (event.action === 'load') {
        for (const [id, pane] of panes)
          if (pane.failed) {
            pane.dispose();
            panes.delete(id);
          }
      }
      render();
    }),
  );
  const observer = new ResizeObserver(measure);
  observer.observe(stage);
  scope.add(() => observer.disconnect());
  scope.listen(doc, 'dragend', () => {
    dragId = undefined;
    for (const r of regions.values()) delete r.element.dataset.drop;
  });
  let registryCleanup = () => {};
  const refreshOptions = (repaintChrome = true) => {
    configure();
    Object.assign(renderOptions, options, { onError: error });
    if (repaintChrome) {
      menu.dispose();
      root.setAttribute('aria-label', message(options, 'Pane workspace'));
      for (const region of regions.values()) {
        region.element.setAttribute('aria-label', message(options, 'Pane region'));
        region.divider?.setAttribute('aria-label', message(options, 'Resize panes'));
        for (const handle of region.element.querySelectorAll<HTMLElement>(
          ':scope > .layouts-corner',
        )) {
          handle.title = message(
            options,
            'Drag inward to split; drag across adjacent regions to join. Escape cancels.',
          );
          handle.setAttribute(
            'aria-label',
            message(options, 'Split or join region from {corner} corner', {
              corner: handle.dataset.corner ?? '',
            }),
          );
        }
      }
      for (const region of regions.values()) region.signature = '';
    }
    windows.refresh();
    render();
  };
  const bindRegistry = () => {
    registryCleanup();
    registryCleanup = options.registry?.subscribe(() => refreshOptions()) ?? (() => {});
  };
  bindRegistry();
  scope.add(() => registryCleanup());
  const refreshTheme = () => {
    if (disposed) return;
    measure();
    for (const region of regions.values()) region.updateTabBar?.();
    windows.refreshTheme();
  };
  const themeObserver = new MutationObserver(refreshTheme);
  for (let ancestor: HTMLElement | null = root; ancestor; ancestor = ancestor.parentElement)
    themeObserver.observe(ancestor, { attributes: true });
  themeObserver.observe(doc.head, { childList: true, subtree: true, characterData: true });
  scope.add(() => themeObserver.disconnect());
  // Cancel asynchronous actions before tearing down views and the owned store.
  scope.add(() => {
    closeScope.dispose();
    windows.dispose();
  });
  render();
  return {
    store: options.store,
    requestClose,
    refreshTheme,
    updateOptions(next) {
      if (disposed) return;
      if ('store' in next || 'initialLayout' in next || 'initialWorkspace' in next)
        throw new Error(
          'Initial configuration cannot be updated; use loadWorkspace or store commands',
        );
      const candidate = { ...options, ...next };
      if (candidate.registry && (next.renderers || next.tabs))
        throw new Error('registry cannot be combined with renderers or tabs');
      validateTheme(candidate.theme ?? {});
      validateTabBar(candidate.tabBar ?? {});
      const sameRegistrations =
        candidate.registry === options.registry ||
        (candidate.registry &&
          options.registry &&
          candidate.registry.list().length === options.registry.list().length &&
          candidate.registry.list().every((entry, index) => {
            const previous = options.registry!.list()[index]!;
            return (
              entry.type === previous.type &&
              entry.title === previous.title &&
              entry.description === previous.description &&
              entry.icon === previous.icon &&
              entry.view === previous.view &&
              entry.create === previous.create &&
              entry.confirmClose === previous.confirmClose &&
              JSON.stringify(entry.keywords) === JSON.stringify(previous.keywords)
            );
          }));
      const repaintChrome =
        !sameRegistrations ||
        (!candidate.registry && candidate.tabs !== options.tabs) ||
        candidate.renderIcon !== options.renderIcon ||
        candidate.popouts !== options.popouts ||
        JSON.stringify(candidate.messages) !== JSON.stringify(options.messages) ||
        JSON.stringify(candidate.shortcuts) !== JSON.stringify(options.shortcuts);
      // Clear maps derived from the old registry when returning to low-level registration.
      if ('registry' in next && !next.registry && options.registry) {
        Object.assign(options, { renderers: undefined, tabs: undefined });
      }
      Object.assign(options, next);
      if ('theme' in next) applyTheme(root, options.theme ?? {});
      if ('tabBar' in next) tabBar = structuredClone(options.tabBar ?? {});
      bindRegistry();
      refreshOptions(repaintChrome);
      refreshTheme();
    },
    exportWorkspace() {
      return {
        version: 1,
        layout: dockLayout(options.store.getSnapshot()),
        theme: structuredClone(options.theme ?? {}),
        tabBar: structuredClone(tabBar),
        autoCollapse: options.store.getAutoCollapse(),
      };
    },
    loadWorkspace(input) {
      if (disposed) throw new Error('Layout has been disposed');
      const preset = parseWorkspace(input);
      options.theme = preset.theme;
      options.tabBar = preset.tabBar;
      tabBar = preset.tabBar;
      applyTheme(root, preset.theme);
      options.store.setAutoCollapse(preset.autoCollapse);
      options.store.load(preset.layout);
      refreshTheme();
    },
    retryPane(id) {
      if (disposed) return;
      const pane = panes.get(id);
      if (pane?.failed) {
        pane.dispose();
        panes.delete(id);
      }
      windows.retryPane(id);
      render();
    },
    setTabBar(next) {
      if (disposed) return;
      validateTabBar(next);
      tabBar = structuredClone(next);
      options.tabBar = tabBar;
      for (const region of regions.values()) region.updateTabBar?.();
    },
    setTheme(theme) {
      if (disposed) return;
      applyTheme(root, theme);
      options.theme = structuredClone(theme);
      refreshTheme();
    },
    popout(id, placement) {
      return windows.open(id, placement);
    },
    returnPane(id) {
      windows.returnPane(id);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scope.dispose();
    },
  };
}
