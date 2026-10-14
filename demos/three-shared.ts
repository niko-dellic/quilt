import { navigationSettings } from './navigation-settings.js';
import { cameraKinds } from './custom-views-layout.js';
import * as THREE from 'three';
import { grayscale } from './three-effect.js';
import { CameraHelpers, NavigationControls } from 'quilt-three';
import type { ControlsContext, ThreeSession } from 'quilt-three';
import { helperDisplay, cameraSync, cameraSyncScope } from './camera-helper-controls.js';
export { layout } from './three-layout.js';

export const cameras = new Map<string, THREE.PerspectiveCamera | THREE.OrthographicCamera>();
for (const [id, position] of [
  ['perspective', [4.5, 3.5, 4.5]],
  ['top', [0, 5, 0]],
  ['front', [0, 0, 5]],
  ['side', [5, 0, 0]],
] as const) {
  const camera =
    id === 'perspective'
      ? new THREE.PerspectiveCamera(40, 1, 0.1, 50)
      : new THREE.OrthographicCamera(-2.3, 2.3, 2.3, -2.3, 0.1, 8);
  camera.position.set(position[0], position[1], position[2]);
  if (id === 'top') camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.name = id;
  cameras.set(id, camera);
}
export function getCamera(id: string) {
  let camera = cameras.get(id);
  if (!camera) {
    const cell = /^custom-view-(\d+)-(\d+)$/.exec(id);
    const kind = cell
      ? cameraKinds[(Number(cell[1]) * 2 + Number(cell[2])) % cameraKinds.length]!
      : 'perspective';
    camera = cameras.get(kind)!.clone();
    camera.layers.set(0);
    camera.name = id;
    cameras.set(id, camera);
  }
  return camera;
}
const cameraTargets = new WeakMap<THREE.Camera, THREE.Vector3>();
const orbitInstances = new Set<NavigationControls>();
const positionListeners = new Set<(camera: THREE.Camera) => void>();

/** Demo policy shared by vanilla and React; targets translate with positions to preserve rotation. */
class CameraPositionSync {
  private syncing = false;
  private readonly leaders = new Map<string, THREE.Camera>();
  private readonly cleanup: (() => void)[];
  constructor(private readonly session: ThreeSession) {
    const changed = (camera: THREE.Camera) => this.sync(camera);
    positionListeners.add(changed);
    const reconcile = () => {
      for (const scope of ['four', 'custom']) {
        const views = session
          .getViews()
          .filter((view) => cameraSyncScope(view.camera.name) === scope);
        const leader = this.leaders.get(scope);
        const source = views.find((view) => view.camera === leader)?.camera ?? views[0]?.camera;
        if (source) this.sync(source);
      }
    };
    this.cleanup = [
      () => {
        positionListeners.delete(changed);
      },
      cameraSync.subscribe(() => {
        const scope = cameraSyncScope(cameraSync.source);
        const source =
          session.getViews().find((view) => view.camera.name === cameraSync.source)?.camera ??
          session.getViews().find((view) => cameraSyncScope(view.camera.name) === scope)?.camera;
        if (source) this.sync(source);
      }),
      session.subscribe({ viewsChanged: reconcile, dispose: () => this.dispose() }),
    ];
    reconcile();
  }
  private sync(source: THREE.Camera): void {
    const scope = cameraSyncScope(source.name);
    if (this.syncing || !scope || !cameraSync.enabled(source.name)) return;
    const views = this.session.getViews();
    if (!views.some((view) => view.camera === source)) return;
    this.leaders.set(scope, source);
    this.syncing = true;
    try {
      for (const camera of new Set(views.map((view) => view.camera))) {
        if (camera === source || cameraSyncScope(camera.name) !== scope) continue;
        const position = source.position.clone();
        const target = (cameraTargets.get(camera) ?? new THREE.Vector3())
          .clone()
          .add(position.clone().sub(camera.position));
        const controls =
          [...orbitInstances].find((instance) => instance.camera === camera && instance.enabled) ??
          [...orbitInstances].find((instance) => instance.camera === camera);
        if (controls) {
          controls.setPosition(position);
        } else {
          camera.position.copy(position);
          cameraTargets.set(camera, target);
        }
        camera.updateMatrixWorld();
      }
      this.session.invalidate();
    } finally {
      this.syncing = false;
    }
  }
  dispose(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
  }
}
export function orbit(context: ControlsContext) {
  const { camera, element, invalidate } = context;
  const target = cameraTargets.get(camera) ?? new THREE.Vector3();
  cameraTargets.set(camera, target);
  const controls = new NavigationControls(context, {
    target,
    orbitTargetPolicy: navigationSettings.orbitTargetPolicy,
  });
  const unsubscribeNavigation = navigationSettings.subscribe(() => {
    controls.orbitTargetPolicy = navigationSettings.orbitTargetPolicy;
  });
  orbitInstances.add(controls);
  const previousPosition = camera.position.clone();
  const change = () => {
    if (previousPosition.distanceToSquared(camera.position) > 1e-18) {
      previousPosition.copy(camera.position);
      for (const listener of positionListeners) listener(camera);
    }
    invalidate();
  };
  const indicator = element.ownerDocument.createElement('span');
  indicator.className = 'demo-free-navigation';
  indicator.textContent = 'Free navigation · Esc to orbit';
  const mode = () => {
    indicator.hidden = controls.mode !== 'free';
  };
  mode();
  element.parentElement!.append(indicator);
  controls.addEventListener('modechange', mode);
  controls.addEventListener('change', change);
  return {
    get enabled() {
      return controls.enabled;
    },
    set enabled(value: boolean) {
      controls.enabled = value;
    },
    update: (delta: number) => controls.update(delta),
    dispose() {
      unsubscribeNavigation();
      indicator.remove();
      orbitInstances.delete(controls);
      controls.removeEventListener('change', change);
      controls.removeEventListener('modechange', mode);
      controls.dispose();
    },
  };
}
// Both adapters use exactly the same camera, controls, and optional effect settings.
export function viewOptions(id: string) {
  return {
    camera: getCamera(id),
    controls: orbit,
    ...(new URLSearchParams(location.search).has('effects') && id === 'perspective'
      ? { pipeline: grayscale }
      : {}),
  };
}
export { populate } from './three-scene.js';

// Display policy belongs to the demo; graphics and pointer tracking belong to quilt-three.
export function createDemoHelpers(session: ThreeSession) {
  const positionSync = new CameraPositionSync(session);
  const helpers = new CameraHelpers(session, {
    visibleIn: (camera) =>
      !cameraSync.enabled(camera.name) &&
      (camera.name.startsWith('custom-view-')
        ? helperDisplay.customVisible()
        : cameraKinds.includes(camera.name as (typeof cameraKinds)[number])),
    ray: 'pointer',
  });
  const sync = () => {
    for (const [id, camera] of cameras)
      helpers.setCameraVisible(camera, helperDisplay.cameraVisible(id));
    session.invalidate();
  };
  const unsubscribe = helperDisplay.subscribe(sync);
  const dispose = () => {
    positionSync.dispose();
    unsubscribe();
    unsubscribeSession();
    helpers.dispose();
  };
  const unsubscribeSession = session.subscribe({ viewsChanged: sync, dispose });
  sync();
  return { helpers, dispose };
}
export function setThreeStatus(message: string) {
  const status = document.querySelector('#status');
  if (status) status.textContent = message;
}
