import { Scene } from 'three';
import { createDemoRenderer } from './three-renderer.js';
import type { PaneRenderer } from 'quilt-vanilla';
import { workspace } from './model.js';
import { ThreeSession } from 'quilt-three';
import 'quilt-vanilla/styles.css';
import {
  cameras,
  populate,
  viewOptions,
  createDemoHelpers,
  setThreeStatus,
} from './three-shared.js';
import { mountHelperToggle } from './camera-helper-controls.js';
const scene = new Scene();
export const session = new ThreeSession({
  scene,
  window,
  onError: console.error,
  createRenderer: createDemoRenderer,
});
const model = populate(scene, () => session.invalidate());
const helperController = createDemoHelpers(session);
const { helpers } = helperController;
export const three: PaneRenderer = (context) => {
  const view = session.register(context, {
    ...viewOptions(context.pane.id),
    onPointer(event, hits) {
      if (event.type === 'click')
        setThreeStatus(`${context.pane.id}: ${hits.length ? 'object selected' : 'background'}`);
    },
  });
  context.onCleanup(mountHelperToggle(context.element, context.pane.id));
  return view;
};
Object.defineProperty(window, 'threeDemo', {
  get: () => ({ workspace, session, cameras, scene, model, helpers }),
});
window.addEventListener(
  'pagehide',
  () => {
    session.dispose();
    helperController.dispose();
    model.dispose();
  },
  { once: true },
);
