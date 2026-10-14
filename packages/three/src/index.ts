import { Raycaster, Vector2, WebGLRenderer } from 'three';
import type { Camera, Intersection, OrthographicCamera, PerspectiveCamera, Scene } from 'three';
import type { PaneContext, PaneView } from 'quilt-vanilla';

export interface ViewControls {
  enabled: boolean;
  update(delta: number): boolean | void;
  dispose(): void;
}
export interface ControlsContext {
  /** Shared input ownership and camera state scope; supplied by ThreeSession. */
  inputScope?: object;
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
/** A mounted viewport. Create through ThreeSession.register(), dispose independently or with its session. */
export class ThreeView implements ViewHandle {
  private disposed = false;
  /** @internal */ readonly cleanups: (() => void)[] = [];
  /** @internal */ controls?: ViewControls;
  /** @internal */ pipeline?: ViewPipeline;
  /** @internal */ size = '';
  /** Current pane-local pointer, or null outside the viewport. */
  pointer: Vector2 | null = null;
  /** @internal */
  constructor(
    readonly context: PaneContext,
    readonly options: ViewOptions,
    /** @internal */ readonly surface: Surface,
    private readonly release: () => void,
    private readonly report: (error: unknown) => void,
    readonly resize: () => void,
  ) {}
  get camera(): Camera {
    return this.options.camera;
  }
  get element(): HTMLElement {
    return this.context.element;
  }
  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.pointer = null;
    for (const cleanup of [
      ...this.cleanups.reverse(),
      () => this.pipeline?.dispose(),
      () => this.controls?.dispose(),
      this.release,
    ]) {
      try {
        cleanup();
      } catch (error) {
        this.report(error);
      }
    }
    this.cleanups.length = 0;
  };
}
/** Optional integrations observe session lifetimes without owning scene assets. */
export interface SessionObserver {
  viewsChanged?(): void;
  /** Return cleanup to restore temporary display state, including after a rendering failure. */
  beforeRender?(view: ThreeView): void | (() => void);
  dispose?(): void;
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
  'pointerenter',
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
  views: Set<ThreeView>;
  lost: boolean;
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

export class ThreeSession {
  readonly scene: Scene;
  private readonly surfaces = new Map<Document, Surface>();
  private readonly observers = new Set<SessionObserver>();
  private readonly views = new Set<ThreeView>();
  private readonly metrics: SessionStats = {
    frames: 0,
    views: 0,
    documents: 0,
    lastFrameMs: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };
  private readonly maxDpr: number;
  private disposed = false;
  private frame = 0;
  private lastTime: number | undefined;
  private rendering = false;
  private frameWindow: Window;
  constructor(private readonly options: SessionOptions) {
    this.scene = options.scene;
    this.maxDpr = options.maxPixelRatio ?? 2;
    if (!Number.isFinite(this.maxDpr) || this.maxDpr <= 0)
      throw new Error('maxPixelRatio must be positive and finite');
    this.frameWindow = options.window;
  }
  get stats(): Readonly<SessionStats> {
    return this.metrics;
  }
  /** Snapshot of registered views, including retained hidden panes. */
  getViews(): readonly ThreeView[] {
    return [...this.views];
  }
  subscribe(observer: SessionObserver): () => void {
    if (this.disposed) throw new Error('Three session has been disposed');
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }
  private notifyViews(): void {
    for (const observer of this.observers) {
      try {
        observer.viewsChanged?.();
      } catch (error) {
        this.report(error);
      }
    }
  }
  private draw(view: ThreeView, render: () => void): void {
    const cleanups: (() => void)[] = [];
    try {
      for (const observer of this.observers) {
        const cleanup = observer.beforeRender?.(view);
        if (cleanup) cleanups.push(cleanup);
      }
      render();
    } finally {
      for (const cleanup of cleanups.reverse()) {
        try {
          cleanup();
        } catch (error) {
          this.report(error);
        }
      }
    }
  }
  private report = (error: unknown) => {
    try {
      this.options.onError?.(error);
    } catch {
      /* Reporting must never interrupt cleanup. */
    }
  };
  invalidate = () => {
    if (this.disposed) return;
    const owner =
      [...this.surfaces.values()].find(
        (surface) => !surface.document.hidden && !surface.window.closed,
      )?.window ?? this.options.window;
    if (this.options.requestFrame) {
      this.options.requestFrame(owner);
      return;
    }
    if (this.frame && this.frameWindow !== owner) {
      this.frameWindow.cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    if (!this.frame) {
      this.frameWindow = owner;
      this.frame = owner.requestAnimationFrame(() => {
        this.frame = 0;
        this.render(this.options.window.performance.now());
      });
    }
  };
  private active = (view: ThreeView) => {
    for (const other of this.views) if (other.options.camera === view.options.camera) return other;
    return view;
  };
  private createSurface(context: PaneContext): Surface {
    const doc = context.document,
      win = context.window;
    const host =
      this.options.container?.(doc) ??
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
        this.options.createRenderer?.(canvas) ??
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
        cleanup: () => {
          for (const fn of cleanup.reverse()) {
            try {
              fn();
            } catch (error) {
              this.report(error);
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
      listener(win, 'resize', this.invalidate);
      listener(doc, 'scroll', this.invalidate, true);
      listener(doc, 'visibilitychange', this.invalidate);
      listener(canvas, 'webglcontextlost', (event) => {
        event.preventDefault();
        surface.lost = true;
        this.report(new Error('Three.js WebGL context lost'));
      });
      listener(canvas, 'webglcontextrestored', () => {
        surface.lost = false;
        this.invalidate();
      });
      const realm = win as Window & typeof globalThis;
      const observer = new realm.ResizeObserver(this.invalidate);
      observer.observe(host);
      cleanup.push(() => observer.disconnect());
      const mutations = new realm.MutationObserver((records) => {
        if (records.some((record) => record.target !== canvas)) this.invalidate();
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
        this.invalidate();
      };
      watchDpr();
      cleanup.push(() => media.removeEventListener('change', watchDpr));
      this.surfaces.set(doc, surface);
      this.metrics.documents = this.surfaces.size;
      return surface;
    } catch (error) {
      for (const fn of cleanup.reverse()) fn();
      renderer?.dispose();
      canvas.remove();
      throw error;
    }
  }
  register(context: PaneContext, viewOptions: ViewOptions): ThreeView {
    if (this.disposed) throw new Error('Three session has been disposed');
    const surface = this.surfaces.get(context.document) ?? this.createSurface(context);
    const element = context.element;
    const view = new ThreeView(
      context,
      viewOptions,
      surface,
      () => {
        this.views.delete(view);
        surface.views.delete(view);
        if (!surface.views.size && context.document !== this.options.window.document) {
          this.surfaces.delete(context.document);
          surface.cleanup();
        }
        this.metrics.views = this.views.size;
        this.metrics.documents = this.surfaces.size;
        this.notifyViews();
        this.invalidate();
      },
      this.report,
      this.invalidate,
    );
    const cleanups = view.cleanups;
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
      this.views.add(view);
      surface.views.add(view);
      if (viewOptions.controls) {
        view.controls = viewOptions.controls({
          inputScope: this,
          camera: viewOptions.camera,
          element: input,
          invalidate: this.invalidate,
        });
        view.controls.enabled = this.active(view) === view;
      }
      if (viewOptions.pipeline) view.pipeline = viewOptions.pipeline(surface.renderer);
      const raycaster = new Raycaster(),
        pointer = new Vector2();
      const handle = (event: Event) => {
        if (this.active(view) !== view) return;
        const e = event as PointerEvent;
        const rect = bounds(element, context.window);
        if (e.type === 'pointerleave' || e.type === 'pointercancel' || !rect) {
          view.pointer = null;
          this.invalidate();
          if (!rect) return;
        }
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
        if (['pointermove', 'pointerenter', 'pointerdown'].includes(e.type)) {
          view.pointer =
            Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1 ? pointer.clone() : null;
        }
        viewOptions.camera.updateMatrixWorld();
        this.options.scene.updateMatrixWorld();
        if (viewOptions.onPointer) {
          raycaster.setFromCamera(pointer, viewOptions.camera);
          raycaster.layers.mask = viewOptions.camera.layers.mask;
          viewOptions.onPointer(
            e,
            raycaster.intersectObjects(this.options.scene.children, true),
            viewOptions.camera,
          );
        }
        this.invalidate();
      };
      for (const event of eventNames) {
        input.addEventListener(event, handle);
        cleanups.push(() => input.removeEventListener(event, handle));
      }
      // The viewport owns right-button gestures. Suppress the native menu even
      // when no application handler cancels it; Quilt menus belong to pane chrome.
      const contextMenu = (event: MouseEvent) => {
        event.stopImmediatePropagation();
        try {
          handle(event);
        } finally {
          event.preventDefault();
        }
      };
      input.addEventListener('contextmenu', contextMenu, true);
      cleanups.push(() => input.removeEventListener('contextmenu', contextMenu, true));
      const realm = context.window as Window & typeof globalThis;
      const observer = new realm.ResizeObserver(this.invalidate);
      observer.observe(element);
      cleanups.push(() => observer.disconnect());
      context.onCleanup(view.dispose);
      this.metrics.views = this.views.size;
      // Exercise graphics initialization synchronously so Quilt can roll back failed mounts.
      surface.renderer.setSize(1, 1, false);
      surface.renderer.setScissorTest(false);
      this.draw(view, () => {
        if (view.pipeline) {
          view.pipeline.resize(1, 1, surface.renderer.getPixelRatio());
          view.pipeline.render({
            renderer: surface.renderer,
            scene: this.options.scene,
            camera: viewOptions.camera,
            width: 1,
            height: 1,
            delta: 0,
            pixelRatio: surface.renderer.getPixelRatio(),
          });
        } else surface.renderer.render(this.options.scene, viewOptions.camera);
      });
      this.invalidate();
      this.notifyViews();
      return view;
    } catch (error) {
      view.dispose();
      throw error;
    }
  }
  render(timestamp: number) {
    if (this.disposed || this.rendering) return;
    this.rendering = true;
    const start = this.options.window.performance.now();
    const delta =
      this.lastTime === undefined
        ? 0
        : Math.max(0, Math.min((timestamp - this.lastTime) / 1000, 0.1));
    this.lastTime = timestamp;
    let moving = false;
    try {
      this.options.update?.(delta);
      this.metrics.drawCalls =
        this.metrics.triangles =
        this.metrics.geometries =
        this.metrics.textures =
          0;
      for (const surface of this.surfaces.values()) {
        if (surface.lost || surface.document.hidden) continue;
        const attached = [...surface.views].find((view) => view.context.element.isConnected);
        const destination =
          this.options.container?.(surface.document) ??
          attached?.context.element.closest<HTMLElement>('.layouts, .layouts-companion');
        if (destination && destination !== surface.host) {
          surface.host = destination;
          destination.append(surface.canvas);
        }
        const { renderer, host, canvas, window: win } = surface;
        const hostRect = host.getBoundingClientRect();
        if (!hostRect.width || !hostRect.height) continue;
        const dpr = Math.min(win.devicePixelRatio || 1, this.maxDpr);
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
          if (view.controls) view.controls.enabled = this.active(view) === view && !!rect;
          if (!rect) {
            view.pointer = null;
            continue;
          }
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
            this.draw(view, () => {
              if (view.pipeline)
                view.pipeline.render({
                  renderer,
                  scene: this.options.scene,
                  camera,
                  width: full.width,
                  height: full.height,
                  delta,
                  pixelRatio: dpr,
                });
              else renderer.render(this.options.scene, camera);
            });
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
        this.metrics.drawCalls += renderer.info.render.calls;
        this.metrics.triangles += renderer.info.render.triangles;
        this.metrics.geometries += renderer.info.memory.geometries;
        this.metrics.textures += renderer.info.memory.textures;
      }
      this.metrics.frames++;
    } catch (error) {
      this.report(error);
    } finally {
      this.rendering = false;
      this.metrics.lastFrameMs = this.options.window.performance.now() - start;
    }
    if (moving || this.options.frameloop === 'always') this.invalidate();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame) this.frameWindow.cancelAnimationFrame(this.frame);
    for (const observer of [...this.observers]) {
      try {
        observer.dispose?.();
      } catch (error) {
        this.report(error);
      }
    }
    this.observers.clear();
    for (const view of [...this.views]) view.dispose();
    for (const surface of this.surfaces.values()) surface.cleanup();
    this.surfaces.clear();
    this.metrics.documents = 0;
    this.lastTime = undefined;
  }
}

/** Convenience factory; equivalent to new ThreeSession(options). */
export function createThreeSession(options: SessionOptions): ThreeSession {
  return new ThreeSession(options);
}

export { CameraHelpers } from './camera-helpers.js';
export type { CameraHelpersOptions } from './camera-helpers.js';

export { NavigationControls } from './navigation-controls.js';
export type {
  NavigationControlsOptions,
  NavigationMode,
  OrbitTargetPolicy,
  NavigationAction,
} from './navigation-controls.js';
