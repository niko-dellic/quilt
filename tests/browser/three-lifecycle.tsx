import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  Scene,
  PerspectiveCamera,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  WebGLRenderer,
} from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createWebGPURenderer } from 'quilt-three/webgpu';
import { ThreeSession, type ThreeRenderer } from 'quilt-three';
import { ThreeSessionProvider, ThreeView, SharedScene } from 'quilt-three-react';
import { Workspace as ReactWorkspace, type PaneProps } from 'quilt-react';
import { Workspace, type WorkspaceHandle } from 'quilt-vanilla';
import type { Layout } from 'quilt-core';
import 'quilt-vanilla/styles.css';
const layout: Layout = {
  version: 1,
  maximized: null,
  popouts: [],
  root: { kind: 'group', id: 'group', panes: ['view'], active: 'view' },
  panes: { view: { id: 'view', type: 'three', title: 'View' } },
};
const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 5;
const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 'green' }));
let assetDisposals = 0;
mesh.geometry.addEventListener('dispose', () => assetDisposals++);
mesh.material.addEventListener('dispose', () => assetDisposals++);
let root: Root | undefined;
let session: ThreeSession;
let workspace: WorkspaceHandle;
let delay = false;
let initialized = 0;
let constructed = 0,
  disposed = 0;
const errors: string[] = [];
const pending: { resolve(): void; reject(error: Error): void }[] = [];
function createRenderer(canvas: HTMLCanvasElement): ThreeRenderer {
  const renderer = new WebGPURenderer({ canvas, forceWebGL: true });
  constructed++;
  const dispose = renderer.dispose.bind(renderer);
  renderer.dispose = async () => {
    await dispose();
    disposed++;
  };
  const initialize = renderer.init.bind(renderer);
  const gate = delay
    ? new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
    : Promise.resolve();
  let initialization: Promise<typeof renderer> | undefined;
  renderer.init = () =>
    (initialization ??= gate
      .then(() => initialize())
      .then((value) => {
        initialized++;
        return value;
      }));
  return renderer;
}
function Pane(props: PaneProps) {
  return <ThreeView paneContext={props} camera={camera} />;
}
const components = { three: Pane };
const onError = (error: unknown) => errors.push(String(error));
const audit = {
  get camera() {
    return camera;
  },
  get session() {
    return session;
  },
  get workspace() {
    return workspace;
  },
  get stats() {
    return {
      constructed,
      initialized,
      disposed,
      assetDisposals,
      pending: pending.length,
      errors: [...errors],
    };
  },
  delay(value: boolean) {
    delay = value;
  },
  settle(fail = false) {
    for (const gate of pending.splice(0))
      fail ? gate.reject(new Error('Deliberate async init failure')) : gate.resolve();
  },
  mount(react = false, webgpu = true, pendingFactory = false, mixedNative = false) {
    const construct = webgpu
      ? createRenderer
      : (canvas: HTMLCanvasElement) => {
          const renderer = new WebGLRenderer({ canvas });
          constructed++;
          initialized++;
          const dispose = renderer.dispose.bind(renderer);
          renderer.dispose = () => {
            dispose();
            disposed++;
          };
          return renderer;
        };
    const factory = (canvas: HTMLCanvasElement) => {
      if (mixedNative && canvas.ownerDocument !== document) {
        constructed++;
        return createWebGPURenderer(canvas, { fallback: false }).then((renderer) => {
          initialized++;
          const dispose = renderer.dispose.bind(renderer);
          renderer.dispose = async () => {
            await dispose();
            disposed++;
          };
          return renderer;
        });
      }
      const renderer = construct(canvas);
      if (!pendingFactory) return renderer;
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject })).then(
        () => renderer,
      );
    };
    const container = document.getElementById('host')!;
    if (react) {
      root = createRoot(container);
      root.render(
        <StrictMode>
          <ThreeSessionProvider
            options={{ createRenderer: factory, onError }}
            onReady={(value) => {
              session = value;
            }}
          >
            <SharedScene>
              <primitive object={mesh} dispose={null} />
            </SharedScene>
            <ReactWorkspace
              initialLayout={layout}
              components={components}
              onReady={(value) => {
                workspace = value;
              }}
              onError={onError}
            />
          </ThreeSessionProvider>
        </StrictMode>,
      );
    } else {
      const scene = new Scene();
      scene.add(mesh);
      session = new ThreeSession({ scene, window, createRenderer: factory, onError });
      workspace = new Workspace({
        container,
        initialLayout: layout,
        onError,
        renderers: { three: (context) => session.register(context, { camera }) },
      });
    }
  },
  async unmount() {
    if (root) {
      root.unmount();
      root = undefined;
    } else workspace.dispose();
    await session.dispose();
  },
};
declare global {
  interface Window {
    graphicsAudit: typeof audit;
  }
}
window.graphicsAudit = audit;
document.getElementById('popout')!.onclick = () => {
  void workspace.popout('view');
};
