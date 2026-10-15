import {
  Component,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createRoot, events, extend, useFrame } from '@react-three/fiber';
import type { RootStore, ReconcilerRoot, Events } from '@react-three/fiber';
import * as THREE from 'three';
import type { PaneProps } from 'quilt-react';
import {
  ThreeSession,
  isWebGPURenderer,
  CameraHelpers as CameraHelpersController,
} from 'quilt-three';
import type { CameraHelpersOptions, SessionOptions, ViewOptions } from 'quilt-three';

interface Bridge {
  session: ThreeSession;
  ready: Promise<void>;
  setScene(children: ReactNode): void;
  pointer(
    element: HTMLElement,
    camera: THREE.Camera,
    event: PointerEvent | MouseEvent | WheelEvent,
  ): void;
}
const Context = createContext<Bridge | null>(null);
function useBridge() {
  const bridge = useContext(Context);
  if (!bridge) throw new Error('Three components require ThreeSessionProvider');
  return bridge;
}
export function useThreeSession(): ThreeSession {
  return useBridge().session;
}
class SceneBoundary extends Component<
  { children: ReactNode; fail(error: unknown): void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    this.props.fail(error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
function FrameOwner({ ready, children }: { ready(): void; children: ReactNode }) {
  // Positive priority delegates drawing to the shared session, while useFrame still runs once.
  useFrame(() => {}, 1);
  useLayoutEffect(ready, [ready]);
  return children;
}
export interface ThreeSessionProviderProps {
  children: ReactNode;
  options?: Omit<SessionOptions, 'scene' | 'window' | 'requestFrame'>;
  onReady?: (session: ThreeSession) => void;
}
/** Owns one persistent R3F scene tree; place outside the Quilt Workspace. Options are mount-only. */
export function ThreeSessionProvider({ children, options, onReady }: ThreeSessionProviderProps) {
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const initial = useRef({ options, onReady });
  useEffect(() => {
    extend(
      Object.fromEntries(
        Object.entries(THREE).filter(([, value]) => typeof value === 'function'),
      ) as Parameters<typeof extend>[0],
    );
    const win = window;
    let root: ReconcilerRoot<HTMLCanvasElement> | undefined;
    let store: RootStore | undefined;
    let content: ReactNode = null;
    let frameWindow: Window = win;
    let animation = 0,
      disposed = false,
      elapsed = 0,
      previous: number | undefined;
    let resolve!: () => void, reject!: (error: unknown) => void;
    const ready = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    void ready.catch(() => {});
    const committed = () => {
      resolve();
      session.invalidate();
    };
    const failed = (error: unknown) => {
      reject(error);
      initial.current.options?.onError?.(error);
    };
    const sceneTree = () => (
      <SceneBoundary fail={failed}>
        <FrameOwner ready={committed}>{content}</FrameOwner>
      </SceneBoundary>
    );
    const drawScene = () => {
      root?.render(sceneTree());
    };
    const session = new ThreeSession({
      ...initial.current.options,
      scene: new THREE.Scene(),
      window: win,
      requestFrame(owner) {
        if (disposed) return;
        if (animation && frameWindow !== owner) {
          frameWindow.cancelAnimationFrame(animation);
          animation = 0;
        }
        if (animation) return;
        frameWindow = owner;
        animation = owner.requestAnimationFrame(() => {
          const time = win.performance.now();
          animation = 0;
          if (previous !== undefined) elapsed += Math.min((time - previous) / 1000, 0.1);
          previous = time;
          try {
            store?.getState().advance(elapsed, true);
            session.render(time);
          } catch (error) {
            failed(error);
          }
        });
      },
      createRenderer(canvas) {
        const created =
          initial.current.options?.createRenderer?.(canvas) ??
          new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        const connect = (renderer: import('quilt-three').ThreeRenderer) => {
          if (!disposed && canvas.ownerDocument === win.document) {
            root = createRoot(canvas);
            const currentRoot = root;
            const initialized = isWebGPURenderer(renderer) ? renderer.init() : Promise.resolve();
            void initialized
              .then(() => {
                if (disposed) return;
                return currentRoot.configure({
                  gl: renderer,
                  scene: session.scene,
                  frameloop: 'never',
                  events,
                  size: { width: 1, height: 1, top: 0, left: 0 },
                  onCreated(state) {
                    state.set({ invalidate: session.invalidate });
                  },
                });
              })
              .then(() => {
                if (disposed) return;
                store = root!.render(sceneTree());
                // Events are forwarded from pane elements, including companion documents.
                store.getState().events.disconnect?.();
                store.getState().setEvents({
                  enabled: true,
                  compute(event, state) {
                    const element = event.currentTarget as HTMLElement;
                    const rect = element.getBoundingClientRect();
                    state.pointer.set(
                      ((event.clientX - rect.left) / rect.width) * 2 - 1,
                      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
                    );
                    state.raycaster.layers.mask = state.camera.layers.mask;
                    state.raycaster.setFromCamera(state.pointer, state.camera);
                  },
                });
              })
              .catch(failed);
          }
          return renderer;
        };
        return 'then' in created ? Promise.resolve(created).then(connect) : connect(created);
      },
    });
    const names: Record<string, keyof Events> = {
      click: 'onClick',
      dblclick: 'onDoubleClick',
      contextmenu: 'onContextMenu',
      wheel: 'onWheel',
      pointerdown: 'onPointerDown',
      pointerup: 'onPointerUp',
      pointermove: 'onPointerMove',
      pointerleave: 'onPointerLeave',
      pointercancel: 'onPointerCancel',
      lostpointercapture: 'onLostPointerCapture',
    };
    const value: Bridge = {
      session,
      ready,
      setScene(next) {
        content = next;
        drawScene();
        session.invalidate();
      },
      pointer(_element, camera, event) {
        if (!store) return;
        const state = store.getState();
        const original = state.camera;
        state.set({ camera: camera as THREE.PerspectiveCamera });
        try {
          const name = names[event.type];
          if (name) state.events.handlers?.[name]?.(event);
        } finally {
          state.set({ camera: original });
        }
      },
    };
    setBridge(value);
    initial.current.onReady?.(session);
    return () => {
      disposed = true;
      if (animation) frameWindow.cancelAnimationFrame(animation);
      reject(new Error('Three session disposed before scene readiness'));
      root?.unmount();
      session.dispose();
    };
  }, []);
  return bridge ? <Context.Provider value={bridge}>{children}</Context.Provider> : null;
}
/** Declare scene content exactly once, outside individual pane components. */
export function SharedScene({ children }: { children: ReactNode }) {
  const bridge = useBridge();
  useLayoutEffect(() => {
    bridge.setScene(children);
  }, [bridge, children]);
  useLayoutEffect(() => () => bridge.setScene(null), [bridge]);
  return null;
}
export interface ThreeViewProps extends ViewOptions {
  paneContext: PaneProps;
  children?: ReactNode;
}
/** The children here are HTML overlays. Shared Three.js JSX belongs in SharedScene. */
export function ThreeView({ paneContext, children, ...options }: ThreeViewProps) {
  const bridge = useBridge();
  const element = useRef<HTMLDivElement>(null);
  const current = useRef(options);
  current.current = options;
  useLayoutEffect(() => {
    if (!element.current) return;
    const host = element.current;
    const view = bridge.session.register(
      { ...paneContext, element: host },
      {
        ...current.current,
        onPointer(event, hits, camera) {
          bridge.pointer(host, camera, event);
          current.current.onPointer?.(event, hits, camera);
        },
      },
    );
    paneContext.deferReady(bridge.ready);
    return () => view.dispose();
  }, [
    bridge,
    paneContext.pane.id,
    paneContext.document,
    options.camera,
    options.controls,
    options.pipeline,
  ]);
  return (
    <div ref={element} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {children}
    </div>
  );
}

// Preserve R3F JSX augmentation for consumers importing only quilt-three-react.
export type { ThreeElements, ThreeEvent } from '@react-three/fiber';

/** Mount inside ThreeSessionProvider, alongside SharedScene (not inside its R3F tree).
 * Visibility is reactive; other options are mount-only.
 */
export function CameraHelpers({ visible = true, ...options }: CameraHelpersOptions) {
  const session = useThreeSession();
  const initial = useRef(options);
  const instance = useRef<CameraHelpersController | null>(null);
  useEffect(() => {
    const helpers = new CameraHelpersController(session, { ...initial.current, visible });
    instance.current = helpers;
    return () => {
      helpers.dispose();
      instance.current = null;
    };
  }, [session]);
  useEffect(() => {
    instance.current?.setVisible(visible);
  }, [visible]);
  return null;
}
