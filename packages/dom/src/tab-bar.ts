import type { Messages } from './messages.js';
import { themePixels } from './theme.js';
import { bindTabTooltip } from './tab-tooltip.js';
import type { TabBarOptions, TabBarStyle } from './types.js';
import type { Scope } from './lifetime.js';

export function validateTabBar(options: TabBarOptions) {
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('Expected tab bar object');
  if (
    options.regions !== undefined &&
    (!options.regions || typeof options.regions !== 'object' || Array.isArray(options.regions))
  )
    throw new Error('Expected tab bar regions');
  for (const style of [options, ...Object.values(options.regions ?? {})]) {
    if (!style || typeof style !== 'object' || Array.isArray(style))
      throw new Error('Expected tab bar style');
    for (const key of Object.keys(style))
      if (
        ![
          'display',
          'attachment',
          'fit',
          'corners',
          'placement',
          'mode',
          'shape',
          'taperWidth',
          ...(style === options ? ['regions'] : []),
        ].includes(key)
      )
        throw new Error(`Unknown tab bar property: ${key}`);
    for (const [key, values] of Object.entries({
      display: ['automatic', 'compact'],
      attachment: ['anchored', 'floating'],
      fit: ['full', 'fit'],
      corners: ['fitted', 'rounded', 'capsule'],
    })) {
      const value = style[key as keyof TabBarStyle];
      if (value !== undefined && !values.includes(String(value)))
        throw new Error(`Unknown tab bar ${key}`);
    }
    if (style.placement !== undefined && !['top', 'left'].includes(style.placement))
      throw new Error('Unknown tab bar placement');
    if (style.mode !== undefined && !['full', 'tapered'].includes(style.mode))
      throw new Error('Unknown tab bar mode');
    if (
      style.shape !== undefined &&
      !['angle', 'round', 'scoop', 'vertical', 'rounded'].includes(style.shape)
    )
      throw new Error('Unknown tab bar shape');
    if (
      style.taperWidth !== undefined &&
      (!Number.isFinite(style.taperWidth) || style.taperWidth <= 0)
    )
      throw new Error('Tab bar taperWidth must be positive and finite');
  }
}

/** Chrome measurement never mounts or replaces application pane views. */
export function bindTabBar(
  region: HTMLElement,
  header: HTMLElement,
  root: HTMLElement,
  scope: Scope,
  getStyle: () => TabBarStyle,
  getMessages: () => Messages = () => ({}),
) {
  const doc = region.ownerDocument,
    win = doc.defaultView!;
  const drawChrome = (
    natural: number,
    occupied: number,
    height: number,
    capWidth: number,
    fits: boolean,
    left: boolean,
    style: TabBarStyle,
  ) => {
    if (style.attachment === 'floating') return;
    if (fits && capWidth > 0) {
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('layouts-tab-cap');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('viewBox', '0 0 1 1');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.width = `${left ? height : capWidth}px`;
      if (left) svg.style.height = `${capWidth}px`;
      const path = doc.createElementNS(svg.namespaceURI, 'path');
      const curve =
        style.shape === 'round'
          ? 'A1 1 0 0 0 1 0'
          : style.shape === 'scoop'
            ? 'A1 1 0 0 1 1 0'
            : 'L1 0';
      path.setAttribute('d', `M0 1 ${curve} H0 Z`);
      if (left) path.setAttribute('transform', 'matrix(0 1 1 0 0 0)');
      svg.append(path);
      header.append(svg);
    }
    // A single closed, inset outline covers the controls and cap. Splitting
    // this between CSS borders and SVG strokes leaves seams and clipped edges.
    const outline = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    outline.classList.add('layouts-tab-outline');
    outline.setAttribute('aria-hidden', 'true');
    outline.setAttribute('viewBox', `0 0 ${left ? height : occupied} ${left ? occupied : height}`);
    outline.style.width = `${left ? height : occupied}px`;
    outline.style.height = `${left ? occupied : height}px`;
    const edge = doc.createElementNS(outline.namespaceURI, 'path');
    const right = Math.max(0.5, occupied - 0.5);
    const bottom = Math.max(0.5, height - 0.5);
    const end = fits && capWidth > 0 ? natural : right;
    const curve =
      fits && capWidth > 0
        ? style.shape === 'round' || style.shape === 'scoop'
          ? `A${Math.max(0.01, right - end)} ${Math.max(0.01, bottom - 0.5)} 0 0 ${style.shape === 'round' ? 1 : 0} ${end} ${bottom}`
          : `L${end} ${bottom}`
        : `V${bottom}`;
    if (style.shape === 'rounded') {
      const radius = Math.max(
        0,
        Math.min(
          parseFloat(win.getComputedStyle(header).borderTopLeftRadius) || 0,
          (right - 0.5) / 2,
          (bottom - 0.5) / 2,
        ),
      );
      edge.setAttribute(
        'd',
        `M${0.5 + radius} 0.5 H${right - radius} Q${right} 0.5 ${right} ${0.5 + radius} V${bottom - radius} Q${right} ${bottom} ${right - radius} ${bottom} H${0.5 + radius} Q0.5 ${bottom} 0.5 ${bottom - radius} V${0.5 + radius} Q0.5 0.5 ${0.5 + radius} 0.5 Z`,
      );
    } else edge.setAttribute('d', `M0.5 0.5 H${right} ${curve} H0.5 Z`);
    if (left) edge.setAttribute('transform', 'matrix(0 1 1 0 0 0)');
    const shared = region.dataset.sharedEdges?.split(' ') ?? [];
    const w = left ? height : occupied;
    const h = left ? occupied : height;
    // Clip only decorative strokes on edges owned by an ancestor split.
    const insets = [
      shared.includes('top') ? 1 : 0,
      shared.includes('right') && w >= region.clientWidth - 0.5 ? 1 : 0,
      shared.includes('bottom') && h >= region.clientHeight - 0.5 ? 1 : 0,
      shared.includes('left') ? 1 : 0,
    ];
    outline.style.clipPath = `inset(${insets.map((value) => `${value}px`).join(' ')})`;
    outline.append(edge);
    header.append(outline);
  };
  const refreshTooltip = bindTabTooltip(region, header, root, scope, getMessages);
  let frame = 0,
    disposed = false;
  const observedContent = new Set<Element>();
  const contentResize = new ResizeObserver(() => schedule());
  const scrollbarClearance = () => {
    const next = new Set<Element>();
    const bounds = region.getBoundingClientRect();
    let right = 0,
      bottom = 0;
    const body = region.querySelector<HTMLElement>(':scope > .layouts-body');
    if (body) {
      for (const element of [body, ...body.querySelectorAll<HTMLElement>('*')]) {
        if (!element.clientWidth || !element.clientHeight) continue;
        const css = win.getComputedStyle(element);
        if (!/(auto|scroll)/.test(css.overflowX + css.overflowY)) continue;
        next.add(element);
        for (const child of element.children) next.add(child);
        const rect = element.getBoundingClientRect();
        const fallback = themePixels(region, '--layouts-scrollbar-size', 6);
        // Overlay scrollbars report zero gutter: use the themed size then.
        if (
          /(auto|scroll)/.test(css.overflowY) &&
          element.scrollHeight > element.clientHeight &&
          Math.abs(bounds.right - rect.right) < 1
        ) {
          const gutter =
            element.offsetWidth -
            element.clientWidth -
            (parseFloat(css.borderLeftWidth) || 0) -
            (parseFloat(css.borderRightWidth) || 0);
          right = Math.max(right, gutter, fallback);
        }
        if (
          /(auto|scroll)/.test(css.overflowX) &&
          element.scrollWidth > element.clientWidth &&
          Math.abs(bounds.bottom - rect.bottom) < 1
        ) {
          const gutter =
            element.offsetHeight -
            element.clientHeight -
            (parseFloat(css.borderTopWidth) || 0) -
            (parseFloat(css.borderBottomWidth) || 0);
          bottom = Math.max(bottom, gutter, fallback);
        }
      }
    }
    for (const element of observedContent) if (!next.has(element)) contentResize.unobserve(element);
    for (const element of next) if (!observedContent.has(element)) contentResize.observe(element);
    observedContent.clear();
    for (const element of next) observedContent.add(element);
    return { right, bottom };
  };
  const measure = () => {
    frame = 0;
    if (disposed || !region.isConnected) return;
    if (region.hasAttribute('data-dedicated')) {
      contentResize.disconnect();
      observedContent.clear();
      region.dataset.tabPlacement = 'top';
      region.dataset.tabBar = 'tapered';
      region.dataset.tabAttachment = 'floating';
      header.removeAttribute('style');
      const padding = Math.max(0, themePixels(region, '--layouts-panel-padding', 8));
      header.style.setProperty('--layouts-floating-inset-x', `${padding}px`);
      header.style.setProperty('--layouts-floating-inset-y', `${padding}px`);
      refreshTooltip();
      header.querySelector('.layouts-tab-cap')?.remove();
      header.querySelector('.layouts-tab-outline')?.remove();
      const visible =
        !header.hidden &&
        Array.from(header.querySelectorAll<HTMLElement>('.layouts-button')).some(
          (button) => button.getClientRects().length > 0,
        );
      const footprint = header.getBoundingClientRect();
      region.style.setProperty(
        '--layouts-tab-bar-width',
        `${visible ? footprint.width + padding : 0}px`,
      );
      region.style.setProperty(
        '--layouts-tab-bar-height',
        `${visible ? footprint.height + padding : 0}px`,
      );
      return;
    }
    const style = getStyle();
    const left = style.placement === 'left';
    const compact = style.display === 'compact';
    region.dataset.tabDisplay = compact ? 'compact' : 'automatic';
    header.dataset.tabDisplay = compact ? 'compact' : 'automatic';
    const floating = style.attachment === 'floating';
    const padding = themePixels(region, '--layouts-panel-padding', 8);
    const inset = floating ? (Number.isFinite(padding) ? Math.max(0, padding) : 8) : 0;
    const scrollbar = floating ? scrollbarClearance() : { right: 0, bottom: 0 };
    const insetX = inset;
    const insetY = inset;
    header.style.setProperty('--layouts-floating-inset-x', `${insetX}px`);
    header.style.setProperty('--layouts-floating-inset-y', `${insetY}px`);
    if (!floating) {
      contentResize.disconnect();
      observedContent.clear();
    }
    const tapered = floating || style.mode === 'tapered';
    region.dataset.tabAttachment = floating ? 'floating' : 'anchored';
    header.dataset.tabCorners = floating
      ? (style.corners ?? 'rounded')
      : style.shape === 'rounded'
        ? 'rounded'
        : 'fitted';
    if (!left) header.style.removeProperty('height');
    region.dataset.tabPlacement = left ? 'left' : 'top';
    refreshTooltip();
    header
      .querySelector('[role=tablist]')
      ?.setAttribute('aria-orientation', left ? 'vertical' : 'horizontal');
    region.dataset.tabBar = tapered ? 'tapered' : 'full';
    header.dataset.tabBarShape = style.shape ?? 'angle';
    header.querySelector('.layouts-tab-cap')?.remove();
    header.querySelector('.layouts-tab-outline')?.remove();
    const items = Array.from(header.querySelectorAll<HTMLElement>('.layouts-tab-item'));
    header.dataset.tabBarEmpty = String(tapered && !items.length);
    const height = header.hidden ? 0 : header.getBoundingClientRect().height;
    // clientWidth rounds fractional split widths up, allowing chrome to spill
    // outside the region and change the stage's scrollbar/resize geometry.
    const available = Math.max(
      0,
      parseFloat(win.getComputedStyle(region).width) - insetX * 2 - scrollbar.right,
    );
    let occupied = available;
    if (left) {
      header.style.removeProperty('width');
      for (const item of items) item.style.removeProperty('--layouts-tab-preferred-width');
      const width = header.hidden ? 0 : header.getBoundingClientRect().width;
      const regionHeight = Math.max(
        0,
        parseFloat(win.getComputedStyle(region).height) - insetY * 2 - scrollbar.bottom,
      );
      let occupiedHeight = regionHeight;
      if (tapered && width) {
        const computed = win.getComputedStyle(header);
        const list = header.querySelector<HTMLElement>('.layouts-tabs')!;
        const controls = Array.from(
          header.querySelectorAll<HTMLElement>(':scope > .layouts-button'),
        );
        const natural =
          items.reduce((sum, item) => sum + parseFloat(win.getComputedStyle(item).flexBasis), 0) +
          Math.max(0, items.length - 1) * (parseFloat(win.getComputedStyle(list).rowGap) || 0) +
          controls.reduce((sum, control) => sum + control.getBoundingClientRect().height, 0) +
          Math.max(0, controls.length - (items.length ? 0 : 1)) *
            (parseFloat(computed.rowGap) || 0) +
          parseFloat(computed.paddingTop) +
          parseFloat(computed.paddingBottom);
        const cap =
          floating || ['vertical', 'rounded'].includes(style.shape ?? '')
            ? 0
            : (style.taperWidth ?? width);
        const fits =
          !(floating && style.fit === 'full') &&
          natural + cap + (floating ? 0 : 12) <= regionHeight;
        occupiedHeight = fits ? natural + cap : regionHeight;
        header.style.height = `${fits ? natural : regionHeight}px`;
        region.dataset.tabBarFilled = String(!fits);
        drawChrome(natural, occupiedHeight, width, cap, fits, true, style);
      } else {
        header.style.removeProperty('height');
        delete region.dataset.tabBarFilled;
      }
      region.style.setProperty(
        '--layouts-tab-bar-width',
        `${occupiedHeight ? width + insetX : 0}px`,
      );
      region.style.setProperty(
        '--layouts-tab-bar-height',
        `${width ? occupiedHeight + insetY : 0}px`,
      );
      return;
    }
    if (!tapered) {
      header.style.removeProperty('width');
      for (const item of items) item.style.removeProperty('--layouts-tab-preferred-width');
      delete region.dataset.tabBarFilled;
    } else if (!height) {
      header.style.width = '0px';
      occupied = 0;
      region.dataset.tabBarFilled = 'false';
    } else {
      // Inline-size container queries suppress intrinsic sizing. Measure a hidden,
      // noninteractive copy with containment disabled, including real icons/fonts.
      const probe = header.cloneNode(true) as HTMLElement;
      probe.classList.add('layouts-tab-measure');
      probe.setAttribute('aria-hidden', 'true');
      probe.inert = true;
      probe.removeAttribute('id');
      for (const node of probe.querySelectorAll('[id]')) node.removeAttribute('id');
      root.append(probe);
      try {
        const widths = Array.from(probe.querySelectorAll<HTMLElement>('.layouts-tab-item')).map(
          (item) => Math.ceil(item.getBoundingClientRect().width),
        );
        const computed = win.getComputedStyle(probe);
        const controls = Array.from(
          probe.querySelectorAll<HTMLElement>(':scope > .layouts-button'),
        );
        const tabGap =
          parseFloat(win.getComputedStyle(probe.querySelector('.layouts-tabs')!).columnGap) || 0;
        const natural = Math.ceil(
          widths.reduce((sum, width) => sum + width, 0) +
            Math.max(0, widths.length - 1) * tabGap +
            controls.reduce((sum, control) => sum + control.getBoundingClientRect().width, 0) +
            parseFloat(computed.paddingLeft) +
            parseFloat(computed.paddingRight) +
            Math.max(0, controls.length - (items.length ? 0 : 1)) *
              (parseFloat(computed.columnGap) || 0),
        );
        const capWidth =
          floating || ['vertical', 'rounded'].includes(style.shape ?? '')
            ? 0
            : (style.taperWidth ?? height);
        // Leave breathing room at the pane edge instead of showing a nearly
        // touching cap. This clearance is not part of the occupied footprint.
        const edgeClearance = floating ? 0 : 12;
        const fits =
          !(floating && style.fit === 'full') && natural + capWidth + edgeClearance <= available;
        items.forEach((item, index) =>
          item.style.setProperty('--layouts-tab-preferred-width', `${widths[index]}px`),
        );
        region.dataset.tabBarFilled = String(!fits);
        header.style.width = `${fits ? natural : available}px`;
        occupied = fits ? natural + capWidth : available;
        drawChrome(natural, occupied, height, capWidth, fits, false, style);
      } finally {
        probe.remove();
      }
    }
    region.style.setProperty('--layouts-tab-bar-width', `${height ? occupied + insetX : 0}px`);
    region.style.setProperty('--layouts-tab-bar-height', `${height ? height + insetY : 0}px`);
  };
  const schedule = () => {
    if (!disposed && !frame) frame = win.requestAnimationFrame(measure);
  };
  let observedHeaderCrossSize = -1;
  const resize = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      if (entry.target === region) changed = true;
      else if (
        (getStyle().placement === 'left' ? entry.contentRect.width : entry.contentRect.height) !==
        observedHeaderCrossSize
      ) {
        observedHeaderCrossSize =
          getStyle().placement === 'left' ? entry.contentRect.width : entry.contentRect.height;
        changed = true;
      }
    }
    // Header width is our output, not a measurement input. Observing our own
    // width writes feeds compression changes back into another measurement.
    if (changed) schedule();
  });
  resize.observe(region);
  resize.observe(header);
  const mutation = new MutationObserver(schedule);
  for (let node: HTMLElement | null = root; node; node = node.parentElement)
    mutation.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
  mutation.observe(doc.head, { subtree: true, childList: true, characterData: true });
  const body = region.querySelector(':scope > .layouts-body');
  const contentMutation = new MutationObserver(() => {
    if (getStyle().attachment === 'floating') schedule();
  });
  if (body)
    contentMutation.observe(body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
  scope.listen(doc.fonts, 'loadingdone', schedule);
  void doc.fonts.ready.then(schedule);
  scope.add(() => {
    disposed = true;
    if (frame) win.cancelAnimationFrame(frame);
    resize.disconnect();
    mutation.disconnect();
    contentMutation.disconnect();
    contentResize.disconnect();
    observedContent.clear();
  });
  return schedule;
}
