import type { TabBarStyle } from './types.js';
import { themePixels } from './theme.js';

/** Measure only chrome, at its smallest presentation, without touching live views. */
export function chromeMinimum(
  region: HTMLElement,
  header: HTMLElement,
  style: TabBarStyle,
): { minWidth: number; minHeight: number } {
  if (header.hidden) return { minWidth: 0, minHeight: 0 };
  const doc = region.ownerDocument;
  const win = doc.defaultView!;
  const left = style.placement === 'left';
  const compact = style.display === 'compact';
  const probe = region.cloneNode(false) as HTMLElement;
  probe.removeAttribute('id');
  probe.removeAttribute('data-node-id');
  probe.dataset.tabPlacement = left ? 'left' : 'top';
  probe.dataset.tabDisplay = compact ? 'compact' : 'automatic';
  probe.dataset.tabAttachment = 'anchored';
  probe.dataset.tabBar = 'full';
  probe.dataset.tabBarFilled = 'true';
  probe.setAttribute('aria-hidden', 'true');
  probe.inert = true;
  probe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:10000px;height:10000px;visibility:hidden;pointer-events:none';
  const bar = header.cloneNode(true) as HTMLElement;
  bar.removeAttribute('style');
  bar.dataset.tabDisplay = probe.dataset.tabDisplay;
  bar.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  bar
    .querySelectorAll('.layouts-tab-cap,.layouts-tab-outline')
    .forEach((element) => element.remove());
  probe.append(bar);
  region.parentElement!.append(probe);
  try {
    const css = (element: Element) => win.getComputedStyle(element);
    const px = (value: string) => parseFloat(value) || 0; // Computed CSS dimensions are pixels.
    const outer = (element: HTMLElement, vertical: boolean) => {
      const c = css(element);
      return (
        (vertical
          ? element.getBoundingClientRect().height
          : element.getBoundingClientRect().width) +
        px(vertical ? c.marginTop : c.marginLeft) +
        px(vertical ? c.marginBottom : c.marginRight)
      );
    };
    const items = [...bar.querySelectorAll<HTMLElement>('.layouts-tab-item')];
    const icon = themePixels(region, '--layouts-icon-size', 16);
    for (const item of items) {
      item.querySelector<HTMLElement>('.layouts-tab-label')!.style.display = 'none';
      if (!left) {
        const close = item.querySelector<HTMLElement>('.layouts-tab-close');
        const showClose = !compact && item.dataset.active === 'true' && !!close;
        if (close) close.style.display = showClose ? 'block' : 'none';
        const minimum = Math.max(
          px(css(item).minWidth),
          icon + (compact ? 16 : 8) + (showClose ? outer(close!, false) : 0),
        );
        item.style.flex = '0 0 ' + minimum + 'px';
        item.style.width = minimum + 'px';
      }
    }
    const list = bar.querySelector<HTMLElement>('.layouts-tabs')!;
    const controls = [...bar.children].filter(
      (child): child is HTMLElement =>
        child instanceof win.HTMLElement && child.classList.contains('layouts-button'),
    );
    const c = css(bar);
    const listCss = css(list);
    const tabs =
      items.reduce((sum, item) => sum + outer(item, left), 0) +
      Math.max(0, items.length - 1) * px(left ? listCss.rowGap : listCss.columnGap);
    const main =
      tabs +
      controls.reduce((sum, control) => sum + outer(control, left), 0) +
      Math.max(0, controls.length + (items.length ? 1 : 0) - 1) *
        px(left ? c.rowGap : c.columnGap) +
      px(left ? c.paddingTop : c.paddingLeft) +
      px(left ? c.paddingBottom : c.paddingRight) +
      px(left ? c.borderTopWidth : c.borderLeftWidth) +
      px(left ? c.borderBottomWidth : c.borderRightWidth);
    const cross = left ? bar.getBoundingClientRect().width : bar.getBoundingClientRect().height;
    // Reserve the possible content scrollbar gutter for floating chrome. This also
    // prevents the minimum from oscillating as content begins/stops scrolling.
    const inset =
      style.attachment === 'floating'
        ? 2 * Math.max(0, themePixels(region, '--layouts-panel-padding', 8)) +
          Math.max(0, themePixels(region, '--layouts-scrollbar-size', 6))
        : 0;
    return {
      minWidth: Math.ceil((left ? cross : main) + inset),
      minHeight: Math.ceil((left ? main : cross) + inset),
    };
  } finally {
    probe.remove();
  }
}
