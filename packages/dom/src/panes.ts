import { message } from './messages.js';
import type { Pane } from 'quilt-core';
import type { ResolvedLayoutOptions, PaneView, PaneRenderer } from './types.js';
import { el } from './lifetime.js';
export interface MountedPane {
  element: HTMLElement;
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
    element.remove();
  };
  let result: MountedPane | undefined;
  const reportError = (error: unknown) => {
    if (result) result.failed = true;
    options.onError?.(error);
  };
  try {
    if (renderer)
      view = renderer({
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
