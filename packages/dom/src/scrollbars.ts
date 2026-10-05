import { OverlayScrollbars } from 'overlayscrollbars';
import type { ScrollbarOptions, ScrollAreaElements } from './types.js';

export function validateScrollbars(value: unknown): asserts value is ScrollbarOptions | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid scrollbars');
  if (
    Object.keys(value).some(
      (key) => !['visibility', 'placement', 'hideDelay', 'revealOn'].includes(key),
    )
  )
    throw new Error('Unknown scrollbar option');
  const options = value as ScrollbarOptions;
  if (options.visibility !== undefined && !['always', 'auto-hide'].includes(options.visibility))
    throw new Error('Invalid scrollbar visibility');
  if (options.placement !== undefined && !['overlay', 'gutter'].includes(options.placement))
    throw new Error('Invalid scrollbar placement');
  if (options.revealOn !== undefined && !['pointer', 'scroll'].includes(options.revealOn))
    throw new Error('Invalid scrollbar revealOn');
  if (
    options.hideDelay !== undefined &&
    (typeof options.hideDelay !== 'number' ||
      !Number.isFinite(options.hideDelay) ||
      options.hideDelay < 0)
  )
    throw new Error('Invalid scrollbar hideDelay');
}

/** One native viewport; application children and scroll APIs stay untouched. */
export class ScrollArea {
  private instance: OverlayScrollbars | undefined;
  private options: ScrollbarOptions | undefined;
  private timer = 0;
  private gutterFrame = 0;
  private pendingStyles = 0;
  private attempted = false;
  private dragging = false;
  private keyboardInput = false;
  private managedTabIndex = false;
  private disposed = false;
  private cleanups: (() => void)[] = [];
  private media: MediaQueryList;
  private win: Window;
  constructor(
    private elements: ScrollAreaElements,
    private report: (error: unknown) => void,
  ) {
    const { host, viewport } = elements;
    this.win = host.ownerDocument.defaultView!;
    this.media = this.win.matchMedia('(forced-colors: active)');
    const listen = (
      target: EventTarget,
      name: string,
      callback: EventListener,
      capture = false,
    ) => {
      target.addEventListener(name, callback, { capture, passive: true });
      this.cleanups.push(() => target.removeEventListener(name, callback, capture));
    };
    // Companion documents copy stylesheet links asynchronously. Measuring before
    // they load can change the observed viewport during its first resize delivery.
    for (const link of host.ownerDocument.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]',
    )) {
      if (link.sheet || link.disabled) continue;
      this.pendingStyles++;
      let settled = false;
      const ready = () => {
        if (settled) return;
        settled = true;
        this.pendingStyles--;
        if (!this.pendingStyles) this.update(this.options);
      };
      listen(link, 'load', ready);
      listen(link, 'error', ready);
    }
    // Track input modality explicitly: text inputs can match :focus-visible after a mouse click.
    listen(
      host.ownerDocument,
      'keydown',
      (event) => {
        this.keyboardInput = true;
        if (!host.contains(event.target as Node)) return;
        const key = event as KeyboardEvent;
        const target = event.target as Element;
        const scrollKey = [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'PageUp',
          'PageDown',
          'Home',
          'End',
          ' ',
        ].includes(key.key);
        const editing = target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
        );
        const activatesControl =
          key.key === ' ' && target.closest('button, a, summary, [role="button"]');
        if (
          this.options?.revealOn === 'pointer' ||
          (scrollKey &&
            !editing &&
            !activatesControl &&
            !key.ctrlKey &&
            !key.metaKey &&
            !key.altKey)
        )
          this.reveal();
      },
      true,
    );
    listen(
      host.ownerDocument,
      'pointerdown',
      () => {
        const wasKeyboard = this.keyboardInput;
        this.keyboardInput = false;
        if (wasKeyboard && host.contains(host.ownerDocument.activeElement)) this.refreshVisible();
      },
      true,
    );
    listen(this.media, 'change', () => this.update(this.options));
    listen(viewport, 'scroll', () => this.reveal());
    listen(viewport, 'wheel', () => this.reveal());
    listen(viewport, 'touchmove', () => this.reveal());
    const pointerReveal = () => {
      if (this.options?.revealOn === 'pointer') this.reveal();
    };
    listen(host, 'pointermove', pointerReveal);
    listen(host, 'pointerenter', pointerReveal);
    listen(host, 'focusin', () => {
      if (this.options?.revealOn === 'pointer') this.reveal();
    });
    listen(host, 'focusout', () => this.refreshVisible());
    listen(host, 'pointerdown', (event) => {
      const target = (event.target as Element | null)?.closest('.os-scrollbar');
      if (target?.parentElement === host) {
        this.dragging = true;
        this.reveal();
      } else pointerReveal();
    });
    const release = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.reveal();
    };
    listen(this.win, 'pointerup', release);
    listen(this.win, 'pointercancel', release);
    listen(this.win, 'blur', release);
  }
  private refreshVisible() {
    if (this.elements.host.dataset.scrollbarsVisible === 'true') this.reveal();
  }
  private reveal() {
    if (!this.instance || this.disposed) return;
    const { host } = this.elements;
    this.win.clearTimeout(this.timer);
    host.dataset.scrollbarsVisible = 'true';
    if (this.options?.visibility === 'always' || this.dragging) return;
    this.timer = this.win.setTimeout(() => {
      this.timer = 0;
      if (!this.keyboardInput || !host.contains(host.ownerDocument.activeElement))
        host.dataset.scrollbarsVisible = 'false';
    }, this.options?.hideDelay ?? 500);
  }
  private reset() {
    this.win.clearTimeout(this.timer);
    this.timer = 0;
    this.win.cancelAnimationFrame(this.gutterFrame);
    this.gutterFrame = 0;
    // A failed initialization can register an instance before returning it.
    if (this.attempted) {
      try {
        (this.instance ?? OverlayScrollbars({ target: this.elements.viewport }))?.destroy();
      } catch (error) {
        this.report(error);
      }
      this.attempted = false;
    }
    const { viewport } = this.elements;
    if (this.managedTabIndex && viewport.getAttribute('tabindex') === '0')
      viewport.removeAttribute('tabindex');
    this.managedTabIndex = false;
    this.instance = undefined;
    const { host } = this.elements;
    delete host.dataset.quiltScrollbars;
    delete host.dataset.scrollbarsVisible;
    host.style.removeProperty('--quilt-scrollbar-gutter-x');
    host.style.removeProperty('--quilt-scrollbar-gutter-y');
  }
  update(options: ScrollbarOptions | undefined) {
    if (this.disposed) return;
    const changed = JSON.stringify(this.options) !== JSON.stringify(options);
    this.options = options === undefined ? undefined : { ...options };
    const { host, viewport } = this.elements;
    const top = viewport.scrollTop,
      left = viewport.scrollLeft;
    try {
      if (!options || this.media.matches) {
        this.reset();
        return;
      }
      if (this.pendingStyles) return;
      host.dataset.quiltScrollbars = options.placement ?? 'overlay';
      const initializing = !this.instance;
      if (!this.instance) {
        if (!viewport.hasAttribute('tabindex')) {
          viewport.tabIndex = 0;
          this.managedTabIndex = true;
        }
        this.attempted = true;
        this.instance = OverlayScrollbars(
          {
            target: viewport,
            elements: { viewport, padding: false, content: false },
            // Attach explicitly: the dependency's slot check uses the opener's HTMLElement.
            scrollbars: { slot: false },
          },
          {
            scrollbars: { theme: 'layouts-scrollbar', autoHide: 'never', dragScroll: true },
          },
          {
            updated: (instance) => {
              const overflow = instance.state().hasOverflow;
              this.win.cancelAnimationFrame(this.gutterFrame);
              // Changing viewport dimensions inside ResizeObserver causes delivery loops.
              this.gutterFrame = this.win.requestAnimationFrame(() => {
                this.gutterFrame = 0;
                if (this.disposed || !this.instance) return;
                for (const axis of ['x', 'y'] as const) {
                  const name = `--quilt-scrollbar-gutter-${axis}`;
                  const value = overflow[axis] ? 'var(--layouts-scrollbar-size, 6px)' : '0px';
                  if (host.style.getPropertyValue(name) !== value)
                    host.style.setProperty(name, value);
                }
              });
            },
          },
        );
      }
      const bars = this.instance.elements();
      for (const bar of [bars.scrollbarHorizontal.scrollbar, bars.scrollbarVertical.scrollbar])
        if (bar.parentElement !== host) host.append(bar);
      this.instance.update(true);
      if (initializing || changed) this.reveal();
    } catch (error) {
      this.reset();
      this.report(error);
    } finally {
      viewport.scrollTop = top;
      viewport.scrollLeft = left;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }
}
