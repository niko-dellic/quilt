import { message } from './messages.js';
import type { Pane } from 'quilt-core';
import type { ResolvedLayoutOptions, PaneView, PaneRenderer } from './types.js';
import { ScrollArea } from './scrollbars.js';
import type { ScrollbarOptions, ScrollAreaElements } from './types.js';
import { el } from './lifetime.js';
export interface MountedPane {
  element: HTMLElement;
  host: HTMLElement;
  updateScrollbars(options: ScrollbarOptions | undefined): void;
  view: PaneView;
  pane: Pane;
  signature: string;
  renderer: PaneRenderer | undefined;
  failed?: boolean;
  dispose(): void;
}
export function mountPane(
  doc: Document,
  pane: Pane,
  location: 'main' | 'popout',
  options: ResolvedLayoutOptions,
): MountedPane {
  const win = doc.defaultView;
  if (!win) throw new Error('Pane needs a live document');
  const element = el(doc, 'div', 'layouts-pane');
  element.dataset.paneId = pane.id;
  const host = el(doc, 'div', 'layouts-pane-host');
  host.append(element);
  const renderer = Object.hasOwn(options.renderers ?? {}, pane.type)
    ? options.renderers?.[pane.type]
    : undefined;
  let view: PaneView = { dispose() {} };
  let observer: ResizeObserver | undefined;
  let disposed = false;
  const controller = new (win as Window & typeof globalThis).AbortController();
  const cleanups: (() => void)[] = [];
  const reportCleanup = (error: unknown) => {
    try {
      options.onError?.(error);
    } catch {
      /* Finish teardown even if reporting fails. */
    }
  };
  let scrollbarOptions = options.scrollbars;
  const areas = new Map<HTMLElement, ScrollArea>();
  const areaHosts = new Set<HTMLElement>();
  const registerScrollArea = ({ host, viewport }: ScrollAreaElements) => {
    if (disposed) return () => {};
    if (
      host === viewport ||
      viewport.parentElement !== host ||
      host.ownerDocument !== doc ||
      (host !== element.parentElement && !element.contains(host))
    )
      throw new Error('Scroll area requires an owned host with a direct-child viewport');
    if (areas.has(viewport) || areaHosts.has(host))
      throw new Error('Scroll area is already registered');
    areaHosts.add(host);
    const area = new ScrollArea({ host, viewport }, reportCleanup);
    areas.set(viewport, area);
    area.update(scrollbarOptions);
    return () => {
      if (areas.get(viewport) !== area) return;
      areas.delete(viewport);
      areaHosts.delete(host);
      area.dispose();
    };
  };
  const updateScrollbars = (value: ScrollbarOptions | undefined) => {
    scrollbarOptions = value;
    for (const area of areas.values()) area.update(value);
  };
  const run = (callback: () => void) => {
    try {
      callback();
    } catch (error) {
      reportCleanup(error);
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    run(() => controller.abort());
    run(() => observer?.disconnect());
    run(() => view.dispose());
    for (const cleanup of cleanups.splice(0).reverse()) run(cleanup);
    for (const area of areas.values()) run(() => area.dispose());
    areas.clear();
    areaHosts.clear();
    host.remove();
  };
  let result: MountedPane | undefined;
  const reportError = (error: unknown) => {
    if (result) result.failed = true;
    options.onError?.(error);
  };
  try {
    registerScrollArea({ host, viewport: element });
    if (renderer)
      view = renderer({
        registerScrollArea,
        signal: controller.signal,
        onCleanup(callback) {
          if (disposed) run(callback);
          else cleanups.push(callback);
        },
        element,
        reportError,
        document: doc,
        window: win,
        pane,
        state: options.getPaneState?.(pane.id),
        location,
      }) ?? { dispose() {} };
    else {
      element.append(
        el(
          doc,
          'div',
          'layouts-placeholder',
          message(options, 'Unknown pane type: {type}. Register a renderer to display this pane.', {
            type: pane.type,
          }),
        ),
      );
      view = { dispose() {} };
    }
    observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        try {
          view.resize?.(rect.width, rect.height);
        } catch (error) {
          options.onError?.(error);
        }
      }
    });
    observer.observe(element);
    result = {
      element,
      host,
      updateScrollbars,
      view,
      pane,
      signature: JSON.stringify(pane),
      renderer,
      dispose,
    };
    if (location === 'main')
      void view.ready?.catch((error) => {
        if (!disposed) reportError(error);
      });
    return result;
  } catch (error) {
    dispose();
    throw error;
  }
}
