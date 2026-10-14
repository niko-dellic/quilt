import { cameraKinds } from './custom-views-layout.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { grayscale } from './three-effect.js';
import { CameraHelpers } from 'quilt-three';
import type { ControlsContext, ThreeSession } from 'quilt-three';
import { helperDisplay } from './camera-helper-controls.js';
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
type CameraPose = { position: THREE.Vector3; target: THREE.Vector3; zoom: number };
const cameraTargets = new WeakMap<THREE.Camera, THREE.Vector3>();
const initialPoses = new WeakMap<THREE.Camera, CameraPose>();
export function orbit({ camera, element, invalidate }: ControlsContext) {
  const viewCamera = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  const target = cameraTargets.get(camera) ?? new THREE.Vector3();
  cameraTargets.set(camera, target);
  const snapshot = (): CameraPose => ({
    position: camera.position.clone(),
    target: target.clone(),
    zoom: viewCamera.zoom,
  });
  if (!initialPoses.has(camera)) initialPoses.set(camera, snapshot());
  const controls = new OrbitControls(camera, element);
  controls.target = target;
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  // Reserve right-click for Quilt's pane menu; Shift+drag and two-finger touch pan.
  controls.mouseButtons.RIGHT = null;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  element.tabIndex = 0;
  element.setAttribute(
    'aria-label',
    'Scene viewport. Drag to orbit, Shift-drag or middle-drag to pan, scroll to zoom, double-click to reset.',
  );
  let drag: { id: number; pose: CameraPose } | undefined;
  const restore = (pose: CameraPose) => {
    controls.disconnect();
    if (drag && element.hasPointerCapture(drag.id)) element.releasePointerCapture(drag.id);
    drag = undefined;
    // Drain residual damping before restoring so reset/cancel stops immediately.
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(pose.position);
    viewCamera.zoom = pose.zoom;
    viewCamera.updateProjectionMatrix();
    controls.target.copy(pose.target);
    controls.update();
    controls.enableDamping = true;
    controls.connect(element);
    invalidate();
  };
  const start = (event: PointerEvent) => {
    if (!controls.enabled || (event.button !== 0 && event.button !== 1)) return;
    element.focus({ preventScroll: true });
    drag = { id: event.pointerId, pose: snapshot() };
  };
  const end = () => {
    drag = undefined;
  };
  const cancel = () => {
    if (drag) restore(drag.pose);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && drag) {
      event.preventDefault();
      cancel();
    }
  };
  const reset = () => {
    if (controls.enabled) restore(initialPoses.get(camera)!);
  };
  element.addEventListener('pointerdown', start, true);
  element.ownerDocument.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', cancel);
  element.ownerDocument.addEventListener('keydown', key);
  element.addEventListener('dblclick', reset);
  controls.addEventListener('change', invalidate);
  return {
    get enabled() {
      return controls.enabled;
    },
    set enabled(value: boolean) {
      controls.enabled = value;
    },
    update: () => controls.update(),
    dispose() {
      element.removeEventListener('pointerdown', start, true);
      element.ownerDocument.removeEventListener('pointerup', end);
      element.removeEventListener('pointercancel', cancel);
      element.ownerDocument.removeEventListener('keydown', key);
      element.removeEventListener('dblclick', reset);
      controls.removeEventListener('change', invalidate);
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
  const helpers = new CameraHelpers(session, {
    visibleIn: (camera) =>
      camera.name.startsWith('custom-view-')
        ? helperDisplay.customVisible()
        : cameraKinds.includes(camera.name as (typeof cameraKinds)[number]),
    ray: 'pointer',
  });
  const sync = () => {
    for (const [id, camera] of cameras)
      helpers.setCameraVisible(camera, helperDisplay.cameraVisible(id));
    session.invalidate();
  };
  const unsubscribe = helperDisplay.subscribe(sync);
  const dispose = () => {
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
