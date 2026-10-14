import { Raycaster, Vector2, WebGLRenderer } from 'three';
import type { Camera, Intersection, OrthographicCamera, PerspectiveCamera, Scene } from 'three';
import type { PaneContext, PaneView } from 'quilt-vanilla';

export interface ViewControls {
  enabled: boolean;
  update(delta: number): boolean | void;
  dispose(): void;
}
export interface ControlsContext {
  camera: Camera;
  element: HTMLElement;
  invalidate(): void;
}
export interface RenderFrame {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  /** Full view dimensions in CSS pixels (before clipping). */
  width: number;
  height: number;
  delta: number;
  pixelRatio: number;
}
/** Pipelines render into the current viewport/scissor and restore any other GL state they change. */
export interface ViewPipeline {
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: RenderFrame): void;
  dispose(): void;
}
export interface ViewOptions {
  camera: Camera;
  controls?: (context: ControlsContext) => ViewControls;
  pipeline?: (renderer: WebGLRenderer) => ViewPipeline;
  onPointer?: (
    event: PointerEvent | MouseEvent | WheelEvent,
    hits: Intersection[],
    camera: Camera,
  ) => void;
}
export interface SessionOptions {
  scene: Scene;
  window: Window;
  frameloop?: 'demand' | 'always';
  maxPixelRatio?: number;
  createRenderer?: (canvas: HTMLCanvasElement) => WebGLRenderer;
  /** Main workspace host, and companion host when called with a companion document. */
  container?: (document: Document) => HTMLElement;
  update?: (delta: number) => void;
  onError?: (error: unknown) => void;
  /** External scheduler, used by the R3F adapter. Must eventually call session.render(). */
  requestFrame?: (window: Window) => void;
}
export interface ViewHandle extends PaneView {
  readonly camera: Camera;
  readonly element: HTMLElement;
}
export interface SessionStats {
  frames: number;
  views: number;
  documents: number;
  lastFrameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}
export interface ThreeSession {
  readonly scene: Scene;
  readonly stats: Readonly<SessionStats>;
  register(context: PaneContext, options: ViewOptions): ViewHandle;
  invalidate(): void;
  /** Render one session tick. Timestamp uses requestAnimationFrame milliseconds. */
  render(timestamp: number): void;
  dispose(): void;
}
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function intersectRects(a: Rect, b: Rect): Rect {
  const left = Math.max(a.left, b.left),
    top = Math.max(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(0, Math.min(a.left + a.width, b.left + b.width) - left),
    height: Math.max(0, Math.min(a.top + a.height, b.top + b.height) - top),
  };
}
export function resizeCamera(camera: Camera, width: number, height: number): void {
  if (!(width > 0 && height > 0)) return;
  const perspective = camera as PerspectiveCamera;
  const orthographic = camera as OrthographicCamera;
  if (perspective.isPerspectiveCamera) {
    perspective.aspect = width / height;
    perspective.updateProjectionMatrix();
  } else if (orthographic.isOrthographicCamera) {
    const center = (orthographic.left + orthographic.right) / 2;
    const halfWidth = ((orthographic.top - orthographic.bottom) * width) / height / 2;
    orthographic.left = center - halfWidth;
    orthographic.right = center + halfWidth;
    orthographic.updateProjectionMatrix();
  }
}
const eventNames = [
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointercancel',
  'lostpointercapture',
  'pointerleave',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
] as const;
interface Surface {
  document: Document;
  window: Window;
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  cleanup(): void;
  views: Set<MountedView>;
  lost: boolean;
}
interface MountedView {
  context: PaneContext;
  options: ViewOptions;
  surface: Surface;
  controls?: ViewControls;
  pipeline?: ViewPipeline;
  cleanup(): void;
  size: string;
}
function bounds(element: HTMLElement, win: Window): { full: Rect; clip: Rect } | undefined {
  if (!element.isConnected || !element.getClientRects().length) return;
  const full = element.getBoundingClientRect();
  let clip: Rect = intersectRects(full, {
    left: 0,
    top: 0,
    width: win.innerWidth,
    height: win.innerHeight,
  });
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    const style = win.getComputedStyle(parent);
    if (parent.hidden || style.display === 'none' || style.visibility === 'hidden') return;
    if (
      parent !== element &&
      /(hidden|clip|auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY)
    ) {
      const r = parent.getBoundingClientRect();
      clip = intersectRects(clip, {
        left: r.left + parent.clientLeft,
        top: r.top + parent.clientTop,
        width: parent.clientWidth,
        height: parent.clientHeight,
      });
    }
  }
  return clip.width > 0 && clip.height > 0 ? { full, clip } : undefined;
}

export function createThreeSession(options: SessionOptions): ThreeSession {
  const surfaces = new Map<Document, Surface>();
  const views = new Set<MountedView>();
  const stats: SessionStats = {
    frames: 0,
    views: 0,
    documents: 0,
    lastFrameMs: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };
  const maxDpr = options.maxPixelRatio ?? 2;
  if (!Number.isFinite(maxDpr) || maxDpr <= 0)
    throw new Error('maxPixelRatio must be positive and finite');
  let disposed = false,
    frame = 0,
    lastTime: number | undefined,
    rendering = false;
  const report = (error: unknown) => {
    try {
      options.onError?.(error);
    } catch {
      /* Reporting must never interrupt cleanup. */
    }
  };
  let frameWindow = options.window;
  const invalidate = () => {
    if (disposed) return;
    const owner =
      [...surfaces.values()].find((surface) => !surface.document.hidden && !surface.window.closed)
        ?.window ?? options.window;
    if (options.requestFrame) {
      options.requestFrame(owner);
      return;
    }
    if (frame && frameWindow !== owner) {
      frameWindow.cancelAnimationFrame(frame);
      frame = 0;
    }
    if (!frame) {
      frameWindow = owner;
      frame = owner.requestAnimationFrame(() => {
        frame = 0;
        session.render(options.window.performance.now());
      });
    }
  };
  const active = (view: MountedView) => {
    for (const other of views) if (other.options.camera === view.options.camera) return other;
    return view;
  };
  function createSurface(context: PaneContext): Surface {
    const doc = context.document,
      win = context.window;
    const host =
      options.container?.(doc) ??
      context.element.closest<HTMLElement>('.layouts, .layouts-companion') ??
      doc.body;
    const canvas = doc.createElement('canvas');
    canvas.dataset.quiltThreeCanvas = '';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
    });
    let renderer: WebGLRenderer | undefined;
    const cleanup: (() => void)[] = [];
    try {
      renderer =
        options.createRenderer?.(canvas) ??
        new WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.autoClear = false;
      renderer.info.autoReset = false;
      host.append(canvas);
      const surface: Surface = {
        document: doc,
        window: win,
        host,
        canvas,
        renderer,
        views: new Set(),
        lost: false,
        cleanup() {
          for (const fn of cleanup.reverse()) {
            try {
              fn();
            } catch (error) {
              report(error);
            }
          }
          try {
            renderer!.dispose();
            renderer!.forceContextLoss();
          } finally {
            canvas.remove();
          }
        },
      };
      const listener = (target: EventTarget, type: string, fn: EventListener, capture = false) => {
        target.addEventListener(type, fn, capture);
        cleanup.push(() => target.removeEventListener(type, fn, capture));
      };
      listener(win, 'resize', invalidate);
      listener(doc, 'scroll', invalidate, true);
      listener(doc, 'visibilitychange', invalidate);
      listener(canvas, 'webglcontextlost', (event) => {
        event.preventDefault();
        surface.lost = true;
        report(new Error('Three.js WebGL context lost'));
      });
      listener(canvas, 'webglcontextrestored', () => {
        surface.lost = false;
        invalidate();
      });
      const realm = win as Window & typeof globalThis;
      const observer = new realm.ResizeObserver(invalidate);
      observer.observe(host);
      cleanup.push(() => observer.disconnect());
      const mutations = new realm.MutationObserver((records) => {
        if (records.some((record) => record.target !== canvas)) invalidate();
      });
      mutations.observe(host, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'style', 'class'],
      });
      cleanup.push(() => mutations.disconnect());
      let media: MediaQueryList;
      const watchDpr = () => {
        media?.removeEventListener('change', watchDpr);
        media = win.matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`);
        media.addEventListener('change', watchDpr);
        invalidate();
      };
      watchDpr();
      cleanup.push(() => media.removeEventListener('change', watchDpr));
      surfaces.set(doc, surface);
      stats.documents = surfaces.size;
      return surface;
    } catch (error) {
      for (const fn of cleanup.reverse()) fn();
      renderer?.dispose();
      canvas.remove();
      throw error;
    }
  }
  const session: ThreeSession = {
    scene: options.scene,
    stats,
    invalidate,
    register(context, viewOptions) {
      if (disposed) throw new Error('Three session has been disposed');
      const surface = surfaces.get(context.document) ?? createSurface(context);
      const element = context.element;
      const cleanups: (() => void)[] = [];
      let mounted = true;
      const view: MountedView = {
        context,
        options: viewOptions,
        surface,
        size: '',
        cleanup() {
          if (!mounted) return;
          mounted = false;
          views.delete(view);
          surface.views.delete(view);
          for (const fn of cleanups.reverse()) {
            try {
              fn();
            } catch (error) {
              report(error);
            }
          }
          try {
            view.pipeline?.dispose();
          } catch (error) {
            report(error);
          }
          try {
            view.controls?.dispose();
          } catch (error) {
            report(error);
          }
          if (!surface.views.size && context.document !== options.window.document) {
            surfaces.delete(context.document);
            surface.cleanup();
          }
          stats.views = views.size;
          stats.documents = surfaces.size;
          invalidate();
        },
      };
      try {
        const previous = {
          position: element.style.position,
          zIndex: element.style.zIndex,
          touchAction: element.style.touchAction,
        };
        Object.assign(element.style, { position: 'relative', zIndex: '1', touchAction: 'none' });
        cleanups.push(() => Object.assign(element.style, previous));
        const input = context.document.createElement('div');
        input.dataset.quiltThreeInput = '';
        Object.assign(input.style, {
          position: 'absolute',
          inset: '0',
          zIndex: '0',
          touchAction: 'none',
        });
        element.prepend(input);
        cleanups.push(() => input.remove());
        views.add(view);
        surface.views.add(view);
        if (viewOptions.controls) {
          view.controls = viewOptions.controls({
            camera: viewOptions.camera,
            element: input,
            invalidate,
          });
          view.controls.enabled = active(view) === view;
        }
        if (viewOptions.pipeline) view.pipeline = viewOptions.pipeline(surface.renderer);
        const raycaster = new Raycaster(),
          pointer = new Vector2();
        const handle = (event: Event) => {
          if (active(view) !== view) return;
          const e = event as PointerEvent;
          const rect = bounds(element, context.window);
          if (!rect) return;
          if (e.type === 'pointerdown') {
            input.setPointerCapture?.(e.pointerId);
          }
          if (
            (e.type === 'pointerup' || e.type === 'pointercancel') &&
            input.hasPointerCapture?.(e.pointerId)
          )
            input.releasePointerCapture(e.pointerId);
          resizeCamera(viewOptions.camera, rect.full.width, rect.full.height);
          pointer.set(
            ((e.clientX - rect.full.left) / rect.full.width) * 2 - 1,
            (-(e.clientY - rect.full.top) / rect.full.height) * 2 + 1,
          );
          viewOptions.camera.updateMatrixWorld();
          options.scene.updateMatrixWorld();
          if (viewOptions.onPointer) {
            raycaster.setFromCamera(pointer, viewOptions.camera);
            raycaster.layers.mask = viewOptions.camera.layers.mask;
            viewOptions.onPointer(
              e,
              raycaster.intersectObjects(options.scene.children, true),
              viewOptions.camera,
            );
          }
          invalidate();
        };
        for (const event of eventNames) {
          input.addEventListener(event, handle);
          cleanups.push(() => input.removeEventListener(event, handle));
        }
        // Controls commonly prevent contextmenu even when Quilt owns the menu.
        // Route it through the pane host before controls consume it, preserving
        // ordinary Quilt bubbling and application onPointer cancellation.
        const contextMenu = (event: MouseEvent) => {
          event.stopImmediatePropagation();
          handle(event);
          if (event.defaultPrevented) return;
          const forwarded = new realm.MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
            screenX: event.screenX,
            screenY: event.screenY,
            button: event.button,
            buttons: event.buttons,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
          });
          if (!element.dispatchEvent(forwarded)) event.preventDefault();
        };
        input.addEventListener('contextmenu', contextMenu, true);
        cleanups.push(() => input.removeEventListener('contextmenu', contextMenu, true));
        const realm = context.window as Window & typeof globalThis;
        const observer = new realm.ResizeObserver(invalidate);
        observer.observe(element);
        cleanups.push(() => observer.disconnect());
        context.onCleanup(view.cleanup);
        stats.views = views.size;
        // Exercise graphics initialization synchronously so Quilt can roll back failed mounts.
        surface.renderer.setSize(1, 1, false);
        surface.renderer.setScissorTest(false);
        if (view.pipeline) {
          view.pipeline.resize(1, 1, surface.renderer.getPixelRatio());
          view.pipeline.render({
            renderer: surface.renderer,
            scene: options.scene,
            camera: viewOptions.camera,
            width: 1,
            height: 1,
            delta: 0,
            pixelRatio: surface.renderer.getPixelRatio(),
          });
        } else surface.renderer.render(options.scene, viewOptions.camera);
        invalidate();
        return { camera: viewOptions.camera, element, dispose: view.cleanup, resize: invalidate };
      } catch (error) {
        view.cleanup();
        throw error;
      }
    },
    render(timestamp) {
      if (disposed || rendering) return;
      rendering = true;
      const start = options.window.performance.now();
      const delta =
        lastTime === undefined ? 0 : Math.max(0, Math.min((timestamp - lastTime) / 1000, 0.1));
      lastTime = timestamp;
      let moving = false;
      try {
        options.update?.(delta);
        stats.drawCalls = stats.triangles = stats.geometries = stats.textures = 0;
        for (const surface of surfaces.values()) {
          if (surface.lost || surface.document.hidden) continue;
          const attached = [...surface.views].find((view) => view.context.element.isConnected);
          const destination =
            options.container?.(surface.document) ??
            attached?.context.element.closest<HTMLElement>('.layouts, .layouts-companion');
          if (destination && destination !== surface.host) {
            surface.host = destination;
            destination.append(surface.canvas);
          }
          const { renderer, host, canvas, window: win } = surface;
          const hostRect = host.getBoundingClientRect();
          if (!hostRect.width || !hostRect.height) continue;
          const dpr = Math.min(win.devicePixelRatio || 1, maxDpr);
          if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
          const size = renderer.getSize(new Vector2());
          if (size.x !== hostRect.width || size.y !== hostRect.height)
            renderer.setSize(hostRect.width, hostRect.height, false);
          renderer.setRenderTarget(null);
          renderer.setScissorTest(false);
          renderer.setClearColor(0, 0);
          renderer.clear();
          renderer.info.reset();
          renderer.setScissorTest(true);
          for (const view of surface.views) {
            const rect = bounds(view.context.element, win);
            if (view.controls) view.controls.enabled = active(view) === view && !!rect;
            if (!rect) continue;
            const { full } = rect;
            const clip = intersectRects(rect.clip, hostRect);
            if (!clip.width || !clip.height) continue;
            const camera = view.options.camera;
            if (view.controls?.enabled) moving = view.controls.update(delta) === true || moving;
            resizeCamera(camera, full.width, full.height);
            camera.updateMatrixWorld();
            renderer.setViewport(
              full.left - hostRect.left,
              hostRect.height - (full.top - hostRect.top) - full.height,
              full.width,
              full.height,
            );
            renderer.setScissor(
              clip.left - hostRect.left,
              hostRect.height - (clip.top - hostRect.top) - clip.height,
              clip.width,
              clip.height,
            );
            const key = `${full.width}:${full.height}:${dpr}`;
            if (view.size !== key) {
              view.pipeline?.resize(full.width, full.height, dpr);
              view.size = key;
            }
            try {
              if (view.pipeline)
                view.pipeline.render({
                  renderer,
                  scene: options.scene,
                  camera,
                  width: full.width,
                  height: full.height,
                  delta,
                  pixelRatio: dpr,
                });
              else renderer.render(options.scene, camera);
            } catch (error) {
              view.context.reportError(error);
            } finally {
              renderer.setRenderTarget(null);
              renderer.setScissorTest(true);
            }
          }
          renderer.setScissorTest(false);
          // Transparent cleared regions leave all non-3D content and chrome visible.
          canvas.style.width = `${hostRect.width}px`;
          canvas.style.height = `${hostRect.height}px`;
          stats.drawCalls += renderer.info.render.calls;
          stats.triangles += renderer.info.render.triangles;
          stats.geometries += renderer.info.memory.geometries;
          stats.textures += renderer.info.memory.textures;
        }
        stats.frames++;
      } catch (error) {
        report(error);
      } finally {
        rendering = false;
        stats.lastFrameMs = options.window.performance.now() - start;
      }
      if (moving || options.frameloop === 'always') invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) frameWindow.cancelAnimationFrame(frame);
      for (const view of [...views]) view.cleanup();
      for (const surface of surfaces.values()) surface.cleanup();
      surfaces.clear();
      stats.documents = 0;
      lastTime = undefined;
    },
  };
  return session;
}
