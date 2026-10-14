import { message } from './messages.js';
import type { Messages } from './messages.js';
import type { Scope } from './lifetime.js';

let nextTooltip = 0;
/** Icon-only tab hints and empty-pane hints follow the region lifetime. */
export function bindTabTooltip(
  region: HTMLElement,
  header: HTMLElement,
  root: HTMLElement,
  scope: Scope,
  getMessages: () => Messages = () => ({}),
) {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  let anchor: HTMLElement | undefined;
  let tooltip: HTMLDivElement | undefined;
  const removeTooltip = () => {
    anchor?.removeAttribute('aria-describedby');
    tooltip?.remove();
    tooltip = undefined;
  };
  const resize = new ResizeObserver(() => refresh());
  const hide = () => {
    removeTooltip();
    resize.disconnect();
    anchor = undefined;
  };
  const needsTooltip = (tab: HTMLElement) => {
    if (tab.matches('.layouts-empty'))
      return !tab.matches(':disabled') && !region.querySelector('.layouts-picker');
    const label = tab.querySelector<HTMLElement>('.layouts-tab-label');
    if (!label || !label.getClientRects().length) return true;
    const css = win.getComputedStyle(label);
    return (
      !label.clientWidth ||
      !label.clientHeight ||
      css.visibility === 'hidden' ||
      css.opacity === '0'
    );
  };
  const refresh = () => {
    if (!anchor) return;
    if (!anchor.isConnected || !anchor.getClientRects().length) {
      hide();
      return;
    }
    if (!needsTooltip(anchor)) {
      removeTooltip();
      return;
    }
    if (!tooltip) {
      tooltip = doc.createElement('div');
      tooltip.className = 'layouts-tab-tooltip';
      tooltip.id = `layouts-tooltip-${++nextTooltip}`;
      tooltip.setAttribute('role', 'tooltip');
      anchor.setAttribute('aria-describedby', tooltip.id);
      root.append(tooltip);
    }
    const empty = anchor.matches('.layouts-empty');
    tooltip.textContent = empty
      ? message({ messages: getMessages() }, 'Click to add a tab')
      : (anchor.getAttribute('aria-label') ?? '');
    const rect = (empty ? region : anchor).getBoundingClientRect();
    const size = tooltip.getBoundingClientRect();
    const horizontal = !empty && region.dataset.tabPlacement !== 'left';
    const x = empty || horizontal ? rect.left + (rect.width - size.width) / 2 : rect.right + 8;
    const y = horizontal ? rect.bottom + 8 : rect.top + (rect.height - size.height) / 2;
    tooltip.style.left = `${Math.max(8, Math.min(x, win.innerWidth - size.width - 8))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(y, win.innerHeight - size.height - 8))}px`;
  };
  const show = (event: Event) => {
    const target = event.target as Element | null;
    const tab = target?.closest<HTMLElement>('.layouts-tab, .layouts-empty');
    if (!tab || !region.contains(tab)) return;
    if (!tab.matches('.layouts-empty') && !header.contains(tab)) return;
    if (anchor !== tab) {
      hide();
      anchor = tab;
      resize.observe(tab);
      const label = tab.querySelector('.layouts-tab-label');
      if (label) resize.observe(label);
    }
    refresh();
  };
  scope.listen(region, 'pointerover', show);
  scope.listen(region, 'focusin', show);
  scope.listen(region, 'pointerout', (event) => {
    if (!anchor?.contains((event as PointerEvent).relatedTarget as Node | null)) hide();
  });
  scope.listen(region, 'focusout', hide);
  scope.listen(region, 'pointerdown', hide);
  scope.listen(region, 'dragstart', hide);
  scope.listen(root, 'scroll', hide, { capture: true });
  scope.listen(win, 'resize', refresh);
  scope.listen(doc, 'keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') hide();
  });
  scope.add(hide);
  return refresh;
}
