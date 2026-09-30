import { message } from './messages.js';
import { chromeIcon } from './chrome-icons.js';
import type { Group, Pane } from 'quilt-core';
import type { ResolvedLayoutOptions } from './types.js';
import { el } from './lifetime.js';
import { shortcutEnabled } from './shortcuts.js';
interface TabDependencies {
  options: ResolvedLayoutOptions;
  requestClose: (id: string) => Promise<boolean>;
  prefix: string;
  act: (fn: () => void) => void;
  getDrag: () => string | undefined;
  setDrag: (id: string | undefined) => void;
  clearDrop: () => void;
  focusActive: () => void;
}
/** Header nodes are disposable; pane views are owned separately by the renderer. */
export function fillTabs(tabs: HTMLElement, group: Group, panes: Pane[], deps: TabDependencies) {
  const { options, prefix, act } = deps;
  const doc = tabs.ownerDocument;
  panes.forEach((pane, i) => {
    const active = pane.id === group.active;
    const item = el(doc, 'div', 'layouts-tab-item');
    item.dataset.active = String(active);
    const tab = el(doc, 'button', 'layouts-tab');
    tab.type = 'button';
    tab.setAttribute('aria-label', pane.title);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.dataset.focusId = `tab-${pane.id}`;
    tab.id = `${prefix}-tab-${pane.id}`;
    tab.setAttribute('aria-controls', `${prefix}-panel-${pane.id}`);
    const icon = el(doc, 'span', 'layouts-tab-icon');
    icon.setAttribute('aria-hidden', 'true');
    let resolved: Element | undefined;
    act(() => {
      resolved = pane.icon ? options.renderIcon?.(pane.icon, doc) : undefined;
    });
    if (resolved) icon.append(resolved);
    else icon.textContent = Array.from(pane.title.trim())[0] || '•';
    tab.append(icon, el(doc, 'span', 'layouts-tab-label', pane.title));
    tab.onclick = () => act(() => options.store.activate(group.id, pane.id));
    tab.draggable = options.store.can(pane.id, 'move') || options.store.can(pane.id, 'reorder');
    tab.ondragstart = (e) => {
      if (!options.store.can(pane.id, 'move') && !options.store.can(pane.id, 'reorder')) {
        e.preventDefault();
        return;
      }
      deps.setDrag(pane.id);
      e.dataTransfer?.setData('text/plain', pane.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    };
    tab.ondragend = () => {
      deps.setDrag(undefined);
      deps.clearDrop();
    };
    const vertical = () => tabs.getAttribute('aria-orientation') === 'vertical';
    const after = (e: DragEvent) => {
      const rect = item.getBoundingClientRect();
      return vertical()
        ? e.clientY > rect.top + rect.height / 2
        : e.clientX > rect.left + rect.width / 2;
    };
    item.ondragover = (e) => {
      const id = deps.getDrag();
      const capability = id && group.panes.includes(id) ? 'reorder' : 'move';
      if (!id || !options.store.can(id, capability) || !options.store.canNode(group.id, capability))
        return;
      e.preventDefault();
      e.stopPropagation();
      deps.clearDrop();
      item.dataset.tabDrop = after(e) ? 'after' : 'before';
    };
    item.ondragleave = () => {
      delete item.dataset.tabDrop;
    };
    item.ondrop = (e) => {
      const id = deps.getDrag();
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      let index = i + (after(e) ? 1 : 0);
      const source = group.panes.indexOf(id);
      // The controller accepts an insertion index after removing the source tab.
      if (source >= 0 && source < index) index--;
      deps.setDrag(undefined);
      deps.clearDrop();
      act(() => options.store.move(id, group.id, 'tab', index, { source: 'user' }));
    };
    tab.onkeydown = (e) => {
      let index = i;
      if (e.key === (vertical() ? 'ArrowDown' : 'ArrowRight')) index = (i + 1) % panes.length;
      else if (e.key === (vertical() ? 'ArrowUp' : 'ArrowLeft'))
        index = (i + panes.length - 1) % panes.length;
      else if (e.key === 'Home') index = 0;
      else if (e.key === 'End') index = panes.length - 1;
      else return;
      e.preventDefault();
      act(() => options.store.activate(group.id, panes[index]!.id));
      deps.focusActive();
    };
    const close = () =>
      act(() => {
        void deps.requestClose(pane.id);
        deps.focusActive();
      });
    item.append(tab);
    if (options.store.can(pane.id, 'close')) {
      const x = el(doc, 'button', 'layouts-button layouts-tab-close');
      x.append(chromeIcon(doc, 'close'));
      x.type = 'button';
      x.title = message(options, 'Close {title}', { title: pane.title });
      x.setAttribute('aria-label', x.title);
      x.dataset.focusId = `close-${pane.id}`;
      x.onclick = close;
      item.append(x);
      item.onmousedown = (e) => {
        if (e.button === 1 && shortcutEnabled(options, 'middleClickClose')) e.preventDefault();
      };
      item.onauxclick = (e) => {
        if (e.button === 1 && shortcutEnabled(options, 'middleClickClose')) {
          e.preventDefault();
          close();
        }
      };
    }
    tabs.append(item);
  });
}
